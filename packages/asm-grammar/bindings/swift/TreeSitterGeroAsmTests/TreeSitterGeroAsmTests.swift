import XCTest
import SwiftTreeSitter
import TreeSitterGeroAsm

final class TreeSitterGeroAsmTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_gero_asm())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Gero Asm grammar")
    }
}
