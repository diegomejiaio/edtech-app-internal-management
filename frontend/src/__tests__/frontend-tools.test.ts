/**
 * Unit tests for UI_ACTION_TOOLS (front/src/types/chat.ts)
 *
 * Verifies the schema/structure of each tool definition in UI_ACTION_TOOLS:
 *   - Required fields: name, description, parameters
 *   - parameters.type === "object"
 *   - Each required parameter exists in properties
 *   - No unexpected tool count drift (exactly 9 tools)
 *   - Specific tool parameter schemas match spec
 */

import { describe, it, expect } from "vitest";
import { UI_ACTION_TOOLS } from "@/types/chat";
import type { FrontendToolDefinition } from "@/types/chat";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function findTool(name: string): FrontendToolDefinition | undefined {
  return UI_ACTION_TOOLS.find((t) => t.name === name);
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema structure tests
// ─────────────────────────────────────────────────────────────────────────────

describe("UI_ACTION_TOOLS — count and base structure", () => {
  it("GIVEN UI_ACTION_TOOLS → has exactly 9 tool definitions", () => {
    /**
     * GIVEN the UI_ACTION_TOOLS array
     * WHEN counting its length
     * THEN it equals 9 (drift guard — adding/removing tools requires updating this test)
     */
    expect(UI_ACTION_TOOLS).toHaveLength(9);
  });

  it("GIVEN every tool → each has name, description, and parameters fields", () => {
    /**
     * GIVEN all tool definitions
     * WHEN checking structure
     * THEN each has non-empty name, non-empty description, and a parameters object
     */
    for (const tool of UI_ACTION_TOOLS) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);

      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(0);

      expect(tool.parameters).toBeDefined();
      expect(typeof tool.parameters).toBe("object");
    }
  });

  it("GIVEN every tool → parameters.type is 'object'", () => {
    /**
     * GIVEN all tool definitions
     * WHEN checking parameters.type
     * THEN each has parameters.type === 'object' (AG-UI protocol requirement)
     */
    for (const tool of UI_ACTION_TOOLS) {
      expect(tool.parameters.type).toBe("object");
    }
  });

  it("GIVEN every tool → all required parameters exist in properties", () => {
    /**
     * GIVEN all tool definitions
     * WHEN checking that required[] params exist in properties
     * THEN each required param key has a corresponding entry in properties
     */
    for (const tool of UI_ACTION_TOOLS) {
      const required = tool.parameters.required ?? [];
      const properties = tool.parameters.properties;
      for (const reqParam of required) {
        expect(properties).toHaveProperty(reqParam);
      }
    }
  });

  it("GIVEN every tool → all tool names are unique", () => {
    /**
     * GIVEN the tool definitions array
     * WHEN extracting all names
     * THEN there are no duplicates
     */
    const names = UI_ACTION_TOOLS.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Per-tool schema validation
// ─────────────────────────────────────────────────────────────────────────────

describe("UI_ACTION_TOOLS — navigate_to", () => {
  it("GIVEN navigate_to tool → has 'route' as required string parameter", () => {
    /**
     * GIVEN the navigate_to tool definition
     * WHEN checking its parameters
     * THEN 'route' is required and typed as string
     */
    const tool = findTool("navigate_to");
    expect(tool).toBeDefined();
    expect(tool!.parameters.required).toContain("route");
    expect(tool!.parameters.properties["route"]).toBeDefined();
    expect(tool!.parameters.properties["route"].type).toBe("string");
  });

  it("GIVEN navigate_to tool → has optional 'params' object parameter", () => {
    /**
     * GIVEN the navigate_to tool definition
     * WHEN checking its parameters
     * THEN 'params' exists as object type but is NOT in required
     */
    const tool = findTool("navigate_to");
    expect(tool!.parameters.properties["params"]).toBeDefined();
    expect(tool!.parameters.properties["params"].type).toBe("object");
    expect(tool!.parameters.required).not.toContain("params");
  });
});

describe("UI_ACTION_TOOLS — select_company", () => {
  it("GIVEN select_company tool → has 'company_id' as required string parameter", () => {
    /**
     * GIVEN the select_company tool definition
     * WHEN checking its parameters
     * THEN 'company_id' is required and typed as string
     */
    const tool = findTool("select_company");
    expect(tool).toBeDefined();
    expect(tool!.parameters.required).toContain("company_id");
    expect(tool!.parameters.properties["company_id"].type).toBe("string");
  });
});

describe("UI_ACTION_TOOLS — set_period", () => {
  it("GIVEN set_period tool → has 'period' as required string parameter in YYYYMM format", () => {
    /**
     * GIVEN the set_period tool definition
     * WHEN checking its parameters
     * THEN 'period' is required, typed as string, with description mentioning YYYYMM format
     */
    const tool = findTool("set_period");
    expect(tool).toBeDefined();
    expect(tool!.parameters.required).toContain("period");
    expect(tool!.parameters.properties["period"].type).toBe("string");
    // Description should mention the YYYYMM format
    expect(tool!.parameters.properties["period"].description).toMatch(/YYYYMM/);
  });
});

describe("UI_ACTION_TOOLS — apply_filter", () => {
  it("GIVEN apply_filter tool → has 'filter_name' with enum values", () => {
    /**
     * GIVEN the apply_filter tool definition
     * WHEN checking 'filter_name' parameter
     * THEN it has an enum with at least validation_status
     */
    const tool = findTool("apply_filter");
    expect(tool).toBeDefined();
    expect(tool!.parameters.required).toContain("filter_name");
    expect(tool!.parameters.required).toContain("value");

    const filterNameParam = tool!.parameters.properties["filter_name"];
    expect(filterNameParam.enum).toBeDefined();
    expect(filterNameParam.enum).toContain("validation_status");
  });

  it("GIVEN apply_filter tool → 'value' is required string", () => {
    /**
     * GIVEN the apply_filter tool definition
     * WHEN checking 'value' parameter
     * THEN it is required and typed as string
     */
    const tool = findTool("apply_filter");
    expect(tool!.parameters.properties["value"].type).toBe("string");
  });
});

describe("UI_ACTION_TOOLS — open_voucher_detail", () => {
  it("GIVEN open_voucher_detail tool → has 'voucher_id' as required string", () => {
    /**
     * GIVEN the open_voucher_detail tool definition
     * WHEN checking its parameters
     * THEN 'voucher_id' is required with string type
     */
    const tool = findTool("open_voucher_detail");
    expect(tool).toBeDefined();
    expect(tool!.parameters.required).toContain("voucher_id");
    expect(tool!.parameters.properties["voucher_id"].type).toBe("string");
  });
});

describe("UI_ACTION_TOOLS — read-only context tools (no required params)", () => {
  const readOnlyTools = [
    "get_current_page",
    "get_selected_company",
    "get_active_period",
    "get_active_filters",
  ];

  it("GIVEN get_current_page, get_selected_company, get_active_period, get_active_filters → each has no required parameters", () => {
    /**
     * GIVEN the 4 read-only context tools
     * WHEN checking their required arrays
     * THEN each has an empty required array (no input parameters needed)
     */
    for (const toolName of readOnlyTools) {
      const tool = findTool(toolName);
      expect(tool).toBeDefined();
      // required should be empty or undefined
      const required = tool!.parameters.required ?? [];
      expect(required).toHaveLength(0);
    }
  });

  it("GIVEN read-only tools → each has empty properties object", () => {
    /**
     * GIVEN the 4 read-only context tools
     * WHEN checking their properties
     * THEN each has an empty properties object (no input parameters defined)
     */
    for (const toolName of readOnlyTools) {
      const tool = findTool(toolName);
      expect(Object.keys(tool!.parameters.properties)).toHaveLength(0);
    }
  });
});
