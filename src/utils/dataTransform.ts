/**
 * Data transformation utilities for handling inconsistent data formats
 */

/**
 * Normalizes various input types to a string array.
 * This function is designed to handle cases where external tools return
 * newline-separated strings instead of proper arrays, preventing "A.map is not a function" errors.
 * 
 * @param input - The input data which could be a string, array, or other types
 * @returns A normalized string array
 * 
 * @example
 * // Handle newline-separated string (common error case)
 * const input1 = "file1.ts\nfile2.js\nfile3.json";
 * const result1 = normalizeToArray(input1); 
 * // Returns: ["file1.ts", "file2.js", "file3.json"]
 * 
 * @example
 * // Handle existing array (normal case)
 * const input2 = ["file1.ts", "file2.js"];
 * const result2 = normalizeToArray(input2);
 * // Returns: ["file1.ts", "file2.js"]
 * 
 * @example
 * // Handle invalid input
 * const input3 = null;
 * const result3 = normalizeToArray(input3);
 * // Returns: []
 */
export function normalizeToArray(input: unknown): string[] {
  // Handle null/undefined cases
  if (input == null) {
    return [];
  }
  
  // If input is already an array, return it directly
  if (Array.isArray(input)) {
    // Ensure all elements are strings and filter out empty ones
    return input
      .map(item => String(item))
      .filter(item => item.trim() !== '');
  }
  
  // If input is a string, split by newlines
  if (typeof input === 'string') {
    return input
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '');
  }
  
  // For any other type, convert to string and return as single-element array
  const stringValue = String(input).trim();
  return stringValue === '' ? [] : [stringValue];
}

/**
 * Type guard to check if a value can be safely used with .map()
 * 
 * @param value - The value to check
 * @returns True if the value has a .map method (is array-like)
 */
export function isArrayLike(value: unknown): value is Array<any> {
  return value != null && Array.isArray(value);
}

/**
 * Safe wrapper for calling .map() on potentially unsafe data
 * 
 * @param input - Input data that should be an array
 * @param mapFn - The mapping function to apply
 * @returns The result of mapping, or empty array if input is invalid
 */
export function safeMap<T, R>(
  input: unknown,
  mapFn: (item: T, index: number) => R
): R[] {
  const normalizedArray = normalizeToArray(input) as T[];
  return normalizedArray.map(mapFn);
} 