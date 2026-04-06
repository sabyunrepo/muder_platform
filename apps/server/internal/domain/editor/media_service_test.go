package editor

import "testing"

func TestParseYouTubeVideoID(t *testing.T) {
	tests := []struct {
		name string
		url  string
		want string
	}{
		{"watch URL", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"},
		{"watch URL with extra params", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share", "dQw4w9WgXcQ"},
		{"short URL", "https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"},
		{"short URL with timestamp", "https://youtu.be/dQw4w9WgXcQ?t=10", "dQw4w9WgXcQ"},
		{"mobile URL", "https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"},
		{"music URL", "https://music.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"},
		{"shorts URL", "https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"},
		{"embed URL", "https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"},
		{"http (not https) - rejected", "http://www.youtube.com/watch?v=dQw4w9WgXcQ", ""},
		{"non-youtube host - rejected", "https://evil.com/watch?v=dQw4w9WgXcQ", ""},
		{"invalid video ID length", "https://www.youtube.com/watch?v=tooshort", ""},
		{"empty URL", "", ""},
		{"malformed URL", "not-a-url", ""},
		{"youtube subdomain SSRF attempt", "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseYouTubeVideoID(tt.url)
			if got != tt.want {
				t.Errorf("parseYouTubeVideoID(%q) = %q, want %q", tt.url, got, tt.want)
			}
		})
	}
}

func TestValidateAudioMagicBytes(t *testing.T) {
	tests := []struct {
		name    string
		header  []byte
		mime    string
		wantErr bool
	}{
		{"MP3 FF FB", []byte{0xFF, 0xFB, 0x00}, "audio/mpeg", false},
		{"MP3 FF F3", []byte{0xFF, 0xF3, 0x00}, "audio/mpeg", false},
		{"MP3 FF F2", []byte{0xFF, 0xF2, 0x00}, "audio/mpeg", false},
		{"MP3 ID3 tag", []byte("ID3\x04\x00"), "audio/mpeg", false},
		{"OGG valid", []byte("OggS\x00\x00\x00\x00"), "audio/ogg", false},
		{"WAV valid", []byte("RIFF\x00\x00\x00\x00WAVEfmt "), "audio/wav", false},
		{"MIME mismatch (MP3 as OGG)", []byte{0xFF, 0xFB, 0x00}, "audio/ogg", true},
		{"Invalid header for MP3", []byte{0x00, 0x00, 0x00}, "audio/mpeg", true},
		{"WAV without WAVE marker", []byte("RIFF\x00\x00\x00\x00AVIf"), "audio/wav", true},
		{"Empty header", []byte{}, "audio/mpeg", true},
		{"Unknown MIME", []byte{0xFF, 0xFB}, "audio/x-unknown", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateAudioMagicBytes(tt.header, tt.mime)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateAudioMagicBytes() err=%v, wantErr=%v", err, tt.wantErr)
			}
		})
	}
}
