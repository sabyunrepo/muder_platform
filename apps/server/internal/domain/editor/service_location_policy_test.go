package editor

import "testing"

func int32Value(value int32) *int32 { return &value }

func TestBuildLocationAccessPolicy(t *testing.T) {
	t.Parallel()

	t.Run("restricted character CSV를 trim/dedupe하고 저장용 문자열을 정규화한다", func(t *testing.T) {
		t.Parallel()
		policy, err := BuildLocationAccessPolicy(stringPtr(" char-1, char-2, char-1,  "), int32Value(2), int32Value(4))
		if err != nil {
			t.Fatalf("BuildLocationAccessPolicy returned error: %v", err)
		}

		if got, want := policy.RestrictedCharacterIDs, []string{"char-1", "char-2"}; !stringSlicesEqual(got, want) {
			t.Fatalf("RestrictedCharacterIDs = %v, want %v", got, want)
		}
		if policy.RestrictedCharacters == nil || *policy.RestrictedCharacters != "char-1,char-2" {
			t.Fatalf("RestrictedCharacters = %v, want char-1,char-2", policy.RestrictedCharacters)
		}
		if policy.IsPublic() {
			t.Fatal("restricted policy should not be public")
		}
	})

	t.Run("빈 제한값은 공개 장소로 해석한다", func(t *testing.T) {
		t.Parallel()
		policy, err := BuildLocationAccessPolicy(stringPtr(" , "), nil, nil)
		if err != nil {
			t.Fatalf("BuildLocationAccessPolicy returned error: %v", err)
		}

		if !policy.IsPublic() {
			t.Fatal("empty restricted characters should be public")
		}
		if policy.RestrictedCharacters != nil {
			t.Fatalf("RestrictedCharacters = %v, want nil", *policy.RestrictedCharacters)
		}
	})

	t.Run("라운드 범위와 캐릭터 제한으로 접근 가능 여부를 판단한다", func(t *testing.T) {
		t.Parallel()
		policy, err := BuildLocationAccessPolicy(stringPtr("char-2"), int32Value(2), int32Value(4))
		if err != nil {
			t.Fatalf("BuildLocationAccessPolicy returned error: %v", err)
		}

		cases := []struct {
			name        string
			characterID string
			round       int32
			want        bool
		}{
			{name: "before visible round", characterID: "char-1", round: 1, want: false},
			{name: "allowed character in range", characterID: "char-1", round: 2, want: true},
			{name: "missing character context on restricted location", characterID: " ", round: 2, want: false},
			{name: "restricted character in range", characterID: "char-2", round: 3, want: false},
			{name: "after visible round", characterID: "char-1", round: 5, want: false},
		}

		for _, tc := range cases {
			tc := tc
			t.Run(tc.name, func(t *testing.T) {
				t.Parallel()
				if got := policy.CanCharacterAccess(tc.characterID, tc.round); got != tc.want {
					t.Fatalf("CanCharacterAccess(%q, %d) = %v, want %v", tc.characterID, tc.round, got, tc.want)
				}
			})
		}
	})

	t.Run("from_round이 until_round보다 크면 거부한다", func(t *testing.T) {
		t.Parallel()
		if _, err := BuildLocationAccessPolicy(nil, int32Value(5), int32Value(3)); err == nil {
			t.Fatal("expected invalid round order error")
		}
	})
}

func stringSlicesEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
