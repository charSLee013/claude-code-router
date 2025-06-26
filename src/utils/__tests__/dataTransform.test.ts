/**
 * Tests for data transformation utilities
 * This test suite verifies that the functions handle both error scenarios
 * (like "A.map is not a function") and normal usage correctly.
 */

import { normalizeToArray, isArrayLike, safeMap } from '../dataTransform';

describe('dataTransform utilities', () => {
  describe('normalizeToArray', () => {
    // Test cases for the error scenario (newline-separated strings)
    describe('Error scenario - newline-separated strings', () => {
      test('should convert newline-separated string to array', () => {
        const input = "file1.ts\nfile2.js\nfile3.json";
        const result = normalizeToArray(input);
        expect(result).toEqual(["file1.ts", "file2.js", "file3.json"]);
      });

      test('should handle string with trailing newlines', () => {
        const input = "file1.ts\nfile2.js\n\n";
        const result = normalizeToArray(input);
        expect(result).toEqual(["file1.ts", "file2.js"]);
      });

      test('should handle string with leading and trailing whitespace', () => {
        const input = "  file1.ts  \n  file2.js  \n  file3.json  ";
        const result = normalizeToArray(input);
        expect(result).toEqual(["file1.ts", "file2.js", "file3.json"]);
      });

      test('should handle empty lines in the middle', () => {
        const input = "file1.ts\n\nfile2.js\n\nfile3.json";
        const result = normalizeToArray(input);
        expect(result).toEqual(["file1.ts", "file2.js", "file3.json"]);
      });

      test('should handle single file without newlines', () => {
        const input = "single-file.ts";
        const result = normalizeToArray(input);
        expect(result).toEqual(["single-file.ts"]);
      });
    });

    // Test cases for normal usage (arrays)
    describe('Normal scenario - arrays', () => {
      test('should return existing string array unchanged', () => {
        const input = ["file1.ts", "file2.js", "file3.json"];
        const result = normalizeToArray(input);
        expect(result).toEqual(["file1.ts", "file2.js", "file3.json"]);
      });

      test('should convert non-string array elements to strings', () => {
        const input = ["file1.ts", 123, true, "file2.js"];
        const result = normalizeToArray(input);
        expect(result).toEqual(["file1.ts", "123", "true", "file2.js"]);
      });

      test('should filter out empty string elements', () => {
        const input = ["file1.ts", "", "  ", "file2.js"];
        const result = normalizeToArray(input);
        expect(result).toEqual(["file1.ts", "file2.js"]);
      });

      test('should handle empty array', () => {
        const input: string[] = [];
        const result = normalizeToArray(input);
        expect(result).toEqual([]);
      });
    });

    // Test cases for edge cases
    describe('Edge cases', () => {
      test('should handle null input', () => {
        const result = normalizeToArray(null);
        expect(result).toEqual([]);
      });

      test('should handle undefined input', () => {
        const result = normalizeToArray(undefined);
        expect(result).toEqual([]);
      });

      test('should handle empty string', () => {
        const result = normalizeToArray("");
        expect(result).toEqual([]);
      });

      test('should handle whitespace-only string', () => {
        const result = normalizeToArray("   \n  \n  ");
        expect(result).toEqual([]);
      });

      test('should handle number input', () => {
        const result = normalizeToArray(42);
        expect(result).toEqual(["42"]);
      });

      test('should handle boolean input', () => {
        const result = normalizeToArray(true);
        expect(result).toEqual(["true"]);
      });

      test('should handle object input', () => {
        const result = normalizeToArray({ name: "test" });
        expect(result).toEqual(["[object Object]"]);
      });
    });
  });

  describe('isArrayLike', () => {
    test('should return true for arrays', () => {
      expect(isArrayLike([])).toBe(true);
      expect(isArrayLike(["a", "b"])).toBe(true);
      expect(isArrayLike([1, 2, 3])).toBe(true);
    });

    test('should return false for non-arrays', () => {
      expect(isArrayLike("string")).toBe(false);
      expect(isArrayLike(123)).toBe(false);
      expect(isArrayLike({})).toBe(false);
      expect(isArrayLike(null)).toBe(false);
      expect(isArrayLike(undefined)).toBe(false);
    });
  });

  describe('safeMap', () => {
    describe('Error prevention scenarios', () => {
      test('should safely map over newline-separated string', () => {
        const input = "file1.ts\nfile2.js\nfile3.json";
        const result = safeMap(input, (file: string) => file.toUpperCase());
        expect(result).toEqual(["FILE1.TS", "FILE2.JS", "FILE3.JSON"]);
      });

      test('should prevent "A.map is not a function" error with string input', () => {
        const input = "test-file.ts";
        expect(() => {
          const result = safeMap(input, (file: string) => `processed-${file}`);
          expect(result).toEqual(["processed-test-file.ts"]);
        }).not.toThrow();
      });

      test('should handle null input gracefully', () => {
        const result = safeMap(null, (file: string) => file.toUpperCase());
        expect(result).toEqual([]);
      });
    });

    describe('Normal usage scenarios', () => {
      test('should work normally with array input', () => {
        const input = ["file1.ts", "file2.js"];
        const result = safeMap(input, (file: string) => file.toUpperCase());
        expect(result).toEqual(["FILE1.TS", "FILE2.JS"]);
      });

      test('should apply mapping function with index', () => {
        const input = ["a", "b", "c"];
        const result = safeMap(input, (item: string, index: number) => `${index}-${item}`);
        expect(result).toEqual(["0-a", "1-b", "2-c"]);
      });
    });
  });

  // Integration test simulating the actual error scenario
  describe('Integration tests - simulating real error scenarios', () => {
    test('should prevent "A.map is not a function" in glob result processing', () => {
      // Simulate the exact scenario from the user's log
      const mockGlobResult = "/Users/charslee/Repo/private/claude-code-router/config.json\n/Users/charslee/Repo/private/claude-code-router/tsconfig.json\n/Users/charslee/Repo/private/claude-code-router/jest.config.js\n/Users/charslee/Repo/private/claude-code-router/test-config.js\n/Users/charslee/Repo/private/claude-code-router/test.config.json";
      
      // This would normally cause "A.map is not a function" error
      // mockGlobResult.map(...) // This would fail
      
      // But with our utility, it works correctly
      const files = normalizeToArray(mockGlobResult);
      const processedFiles = files.map(file => {
        const filename = file.split('/').pop();
        return { path: file, name: filename };
      });
      
      expect(processedFiles).toHaveLength(5);
      expect(processedFiles[0]).toEqual({
        path: "/Users/charslee/Repo/private/claude-code-router/config.json",
        name: "config.json"
      });
      expect(processedFiles[4]).toEqual({
        path: "/Users/charslee/Repo/private/claude-code-router/test.config.json",
        name: "test.config.json"
      });
    });

    test('should work seamlessly when glob returns proper array', () => {
      // Simulate the scenario where glob returns a proper array (normal case)
      const mockGlobResult = [
        "/Users/charslee/Repo/private/claude-code-router/config.json",
        "/Users/charslee/Repo/private/claude-code-router/tsconfig.json"
      ];
      
      const files = normalizeToArray(mockGlobResult);
      const processedFiles = files.map(file => file.split('/').pop());
      
      expect(processedFiles).toEqual(["config.json", "tsconfig.json"]);
    });
  });
}); 