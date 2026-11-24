package handlers

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"brainmap-backend/storage"
)

func TestAttachmentValidationAndStorage(t *testing.T) {
	encoded := base64.StdEncoding.EncodeToString([]byte("image data"))
	for _, tc := range []struct {
		raw   string
		valid bool
	}{
		{"data:image/png;base64," + encoded, true},
		{"data:application/pdf;base64," + encoded, true},
		{"data:text/html;base64," + encoded, false},
		{"data:image/png;base64,%%%", false},
		{"bad", false},
	} {
		_, err := parseAttachment(tc.raw, "sample.png")
		if (err == nil) != tc.valid {
			t.Errorf("parseAttachment(%q): %v", tc.raw, err)
		}
	}
	a, err := parseAttachment("data:image/png;base64,"+encoded, "../sample.png")
	if err != nil {
		t.Fatal(err)
	}
	if a.name != "sample.png" {
		t.Fatalf("unsafe name: %s", a.name)
	}
	old := storage.BaseDir
	storage.BaseDir = t.TempDir()
	t.Cleanup(func() { storage.BaseDir = old })
	url, err := saveAttachment("map-1", a)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(url, "/api/media/admin/map-1/") {
		t.Fatal(url)
	}
	files, err := os.ReadDir(filepath.Join(storage.BaseDir, "map-1"))
	if err != nil || len(files) != 1 {
		t.Fatalf("saved files: %v, %v", files, err)
	}
	if _, err := saveAttachment("../escape", a); err == nil {
		t.Fatal("unsafe map ID accepted")
	}
}
