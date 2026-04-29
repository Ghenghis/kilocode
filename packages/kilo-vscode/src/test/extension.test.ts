import * as assert from "assert"

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode"
// import * as myExtension from '../../extension';

// NOTE: This file uses Mocha's `suite/test` API for the VS Code integration test runner
// (`vscode-test`). Bun's `bun test` discovery picks it up but does not provide those
// globals, causing a `ReferenceError: suite is not defined`. Guard the registration so
// the file is a no-op under Bun while still working under the VS Code test harness.
declare const suite: ((name: string, body: () => void) => void) | undefined
declare const test: ((name: string, body: () => void) => void) | undefined

if (typeof suite === "function" && typeof test === "function") {
  suite("Extension Test Suite", () => {
    vscode.window.showInformationMessage("Start all tests.")

    test("Sample test", () => {
      assert.strictEqual(-1, [1, 2, 3].indexOf(5))
      assert.strictEqual(-1, [1, 2, 3].indexOf(0))
    })
  })
}
