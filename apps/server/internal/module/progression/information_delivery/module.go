package informationdelivery

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func init() {
	engine.Register("information_delivery", func() engine.Module { return NewModule() })
}

const (
	targetCharacter  = "character"
	targetAllPlayers = "all_players"
)

type deliveryTarget struct {
	Type        string `json:"type"`
	CharacterID string `json:"character_id,omitempty"`
}

type deliveryConfig struct {
	ID                string         `json:"id"`
	Target            deliveryTarget `json:"target"`
	ReadingSectionIDs []string       `json:"reading_section_ids"`
}

type deliverInformationParams struct {
	Deliveries []deliveryConfig `json:"deliveries"`
}

type deliveredItem struct {
	DeliveryID        string   `json:"deliveryId"`
	ReadingSectionIDs []string `json:"readingSectionIds"`
}

type moduleState struct {
	VisibleReadingSectionIDs []string        `json:"visibleReadingSectionIds"`
	Deliveries               []deliveredItem `json:"deliveries"`
}

type Module struct {
	mu sync.RWMutex

	deps engine.ModuleDeps

	// all-player deliveries are visible to every viewer once delivered.
	allPlayerSections map[string]struct{}
	allPlayerItems    map[string]deliveredItem

	// playerDeliveries stores player-specific deliveries after target resolution.
	playerSections map[uuid.UUID]map[string]struct{}
	playerItems    map[uuid.UUID]map[string]deliveredItem

	// targetCodeDeliveries is used when a session has no PlayerInfoProvider or a
	// future reconnect resolves the player after delivery time. BuildStateFor can
	// still match by PlayerRuntimeInfo.TargetCode.
	targetCodeSections map[string]map[string]struct{}
	targetCodeItems    map[string]map[string]deliveredItem

	// appliedDeliveryIDs makes phase re-entry/retry idempotent.
	appliedDeliveryIDs map[string]struct{}
}

func NewModule() *Module {
	return &Module{}
}

func (m *Module) Name() string { return "information_delivery" }

func (m *Module) Init(_ context.Context, deps engine.ModuleDeps, _ json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.deps = deps
	m.allPlayerSections = map[string]struct{}{}
	m.allPlayerItems = map[string]deliveredItem{}
	m.playerSections = map[uuid.UUID]map[string]struct{}{}
	m.playerItems = map[uuid.UUID]map[string]deliveredItem{}
	m.targetCodeSections = map[string]map[string]struct{}{}
	m.targetCodeItems = map[string]map[string]deliveredItem{}
	m.appliedDeliveryIDs = map[string]struct{}{}
	return nil
}

func (m *Module) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	sections := map[string]struct{}{}
	for id := range m.allPlayerSections {
		sections[id] = struct{}{}
	}
	for _, perPlayer := range m.playerSections {
		for id := range perPlayer {
			sections[id] = struct{}{}
		}
	}
	for _, perTarget := range m.targetCodeSections {
		for id := range perTarget {
			sections[id] = struct{}{}
		}
	}

	items := map[string]deliveredItem{}
	for id, item := range m.allPlayerItems {
		items[id] = item
	}
	for _, perPlayer := range m.playerItems {
		for id, item := range perPlayer {
			items[id] = item
		}
	}
	for _, perTarget := range m.targetCodeItems {
		for id, item := range perTarget {
			items[id] = item
		}
	}

	return json.Marshal(moduleState{
		VisibleReadingSectionIDs: sortedKeys(sections),
		Deliveries:               sortedItems(items),
	})
}

func (m *Module) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	sections := map[string]struct{}{}
	items := map[string]deliveredItem{}
	mergeSections(sections, m.allPlayerSections)
	mergeItems(items, m.allPlayerItems)
	mergeSections(sections, m.playerSections[playerID])
	mergeItems(items, m.playerItems[playerID])

	if m.deps.PlayerInfoProvider != nil {
		if info, ok := m.deps.PlayerInfoProvider.PlayerRuntimeInfo(context.Background(), playerID); ok {
			mergeSections(sections, m.targetCodeSections[info.TargetCode])
			mergeItems(items, m.targetCodeItems[info.TargetCode])
		}
	}

	return json.Marshal(moduleState{
		VisibleReadingSectionIDs: sortedKeys(sections),
		Deliveries:               sortedItems(items),
	})
}

func (m *Module) HandleMessage(_ context.Context, _ uuid.UUID, msgType string, _ json.RawMessage) error {
	return fmt.Errorf("information_delivery: unknown message type %q", msgType)
}

func (m *Module) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.allPlayerSections = nil
	m.allPlayerItems = nil
	m.playerSections = nil
	m.playerItems = nil
	m.targetCodeSections = nil
	m.targetCodeItems = nil
	m.appliedDeliveryIDs = nil
	return nil
}

func (m *Module) ReactTo(ctx context.Context, action engine.PhaseActionPayload) error {
	if action.Action != engine.ActionDeliverInformation {
		return nil
	}
	var params deliverInformationParams
	if len(action.Params) == 0 {
		return nil
	}
	if err := json.Unmarshal(action.Params, &params); err != nil {
		return fmt.Errorf("information_delivery: invalid params: %w", err)
	}
	m.applyDeliveries(ctx, params.Deliveries)
	return nil
}

func (m *Module) SupportedActions() []engine.PhaseAction {
	return []engine.PhaseAction{engine.ActionDeliverInformation}
}

func (m *Module) Schema() json.RawMessage {
	return json.RawMessage(`{"type":"object","properties":{},"additionalProperties":false}`)
}

func (m *Module) applyDeliveries(ctx context.Context, deliveries []deliveryConfig) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, delivery := range deliveries {
		delivery.ID = normalizeDeliveryID(delivery)
		if _, applied := m.appliedDeliveryIDs[delivery.ID]; applied {
			continue
		}
		sections := uniqueStrings(delivery.ReadingSectionIDs)
		if len(sections) == 0 {
			continue
		}
		item := deliveredItem{DeliveryID: delivery.ID, ReadingSectionIDs: sections}
		switch delivery.Target.Type {
		case targetAllPlayers:
			mergeStringIDs(m.allPlayerSections, sections)
			m.allPlayerItems[item.DeliveryID] = item
		case targetCharacter:
			if delivery.Target.CharacterID == "" {
				continue
			}
			m.applyCharacterDelivery(ctx, delivery.Target.CharacterID, item)
		default:
			continue
		}
		m.appliedDeliveryIDs[delivery.ID] = struct{}{}
	}
}

func (m *Module) applyCharacterDelivery(ctx context.Context, characterID string, item deliveredItem) {
	if m.deps.PlayerInfoProvider != nil {
		if playerID, ok := m.deps.PlayerInfoProvider.ResolvePlayerID(ctx, characterID); ok {
			if m.playerSections[playerID] == nil {
				m.playerSections[playerID] = map[string]struct{}{}
			}
			if m.playerItems[playerID] == nil {
				m.playerItems[playerID] = map[string]deliveredItem{}
			}
			mergeStringIDs(m.playerSections[playerID], item.ReadingSectionIDs)
			m.playerItems[playerID][item.DeliveryID] = item
			return
		}
	}
	if m.targetCodeSections[characterID] == nil {
		m.targetCodeSections[characterID] = map[string]struct{}{}
	}
	if m.targetCodeItems[characterID] == nil {
		m.targetCodeItems[characterID] = map[string]deliveredItem{}
	}
	mergeStringIDs(m.targetCodeSections[characterID], item.ReadingSectionIDs)
	m.targetCodeItems[characterID][item.DeliveryID] = item
}

func normalizeDeliveryID(delivery deliveryConfig) string {
	if delivery.ID != "" {
		return delivery.ID
	}
	return delivery.Target.Type + ":" + delivery.Target.CharacterID + ":" + joinSorted(uniqueStrings(delivery.ReadingSectionIDs))
}

func mergeStringIDs(dst map[string]struct{}, ids []string) {
	for _, id := range ids {
		if id != "" {
			dst[id] = struct{}{}
		}
	}
}

func mergeSections(dst map[string]struct{}, src map[string]struct{}) {
	for id := range src {
		dst[id] = struct{}{}
	}
}

func mergeItems(dst map[string]deliveredItem, src map[string]deliveredItem) {
	for id, item := range src {
		dst[id] = item
	}
}

func uniqueStrings(ids []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	sort.Strings(out)
	return out
}

func sortedKeys(set map[string]struct{}) []string {
	out := make([]string, 0, len(set))
	for id := range set {
		out = append(out, id)
	}
	sort.Strings(out)
	return out
}

func sortedItems(items map[string]deliveredItem) []deliveredItem {
	out := make([]deliveredItem, 0, len(items))
	for _, item := range items {
		item.ReadingSectionIDs = uniqueStrings(item.ReadingSectionIDs)
		out = append(out, item)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].DeliveryID < out[j].DeliveryID })
	return out
}

func joinSorted(ids []string) string {
	out := ""
	for i, id := range ids {
		if i > 0 {
			out += ","
		}
		out += id
	}
	return out
}

var (
	_ engine.Module            = (*Module)(nil)
	_ engine.ConfigSchema      = (*Module)(nil)
	_ engine.PhaseReactor      = (*Module)(nil)
	_ engine.PlayerAwareModule = (*Module)(nil)
)
