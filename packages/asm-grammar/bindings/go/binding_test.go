package tree_sitter_gero_asm_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_gero_asm "github.com/salty-max/gero_2.0/packages/asm-grammar/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_gero_asm.Language())
	if language == nil {
		t.Errorf("Error loading Gero Asm grammar")
	}
}
