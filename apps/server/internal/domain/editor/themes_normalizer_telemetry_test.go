package editor

import (
	"bytes"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
)

func TestLogLegacyConfigRead_EmitsAxesWithoutRawConfig(t *testing.T) {
	var buf bytes.Buffer
	svc := &service{logger: zerolog.New(&buf)}
	themeID := uuid.MustParse("11111111-1111-1111-1111-111111111111")

	svc.logLegacyConfigRead(themeID, []string{"modules_array", "clue_placement"})

	out := buf.String()
	assert.Contains(t, out, "editor config_json legacy shape normalized on read")
	assert.Contains(t, out, `"theme_id":"11111111-1111-1111-1111-111111111111"`)
	assert.Contains(t, out, `"legacy_axes":["modules_array","clue_placement"]`)
	assert.NotContains(t, out, "clue-secret")
	assert.NotContains(t, out, `"config_json"`)
}

func TestLogLegacyConfigRead_SkipsCanonicalConfig(t *testing.T) {
	var buf bytes.Buffer
	svc := &service{logger: zerolog.New(&buf)}

	svc.logLegacyConfigRead(uuid.New(), nil)

	assert.True(t, strings.TrimSpace(buf.String()) == "")
}
