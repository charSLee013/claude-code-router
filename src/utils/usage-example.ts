/**
 * Usage examples for dataTransform utilities
 * This file demonstrates how to use the dataTransform functions
 * to fix "A.map is not a function" errors in real scenarios.
 */

import { normalizeToArray, safeMap } from './dataTransform';

/**
 * Example 1: Fix "A.map is not a function" error when processing glob results
 */
export function processFileSearchResults(globResult: unknown): Array<{ name: string; path: string; extension: string }> {
  // Without normalizeToArray, this could cause "A.map is not a function" error
  // if globResult is a newline-separated string instead of an array
  
  // ❌ This would fail if globResult is a string:
  // return globResult.map(file => processFile(file)); // TypeError: A.map is not a function
  
  // ✅ This works regardless of globResult type:
  const files = normalizeToArray(globResult);
  return files.map(file => {
    const pathParts = file.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const extension = fileName.split('.').pop() || '';
    
    return {
      name: fileName,
      path: file,
      extension: extension
    };
  });
}

/**
 * Example 2: Using safeMap for even more protection
 */
export function processFilesWithSafeMap(searchResult: unknown): string[] {
  // safeMap handles both the normalization and mapping in one step
  return safeMap(searchResult, (file: string) => {
    return `Processed: ${file}`;
  });
}

/**
 * Example 3: Real-world scenario - filtering and processing config files
 */
export function findConfigFiles(searchResult: unknown): Array<{ file: string; type: string }> {
  const files = normalizeToArray(searchResult);
  
  return files
    .filter(file => {
      const fileName = file.split('/').pop() || '';
      return fileName.includes('config') || fileName.includes('Config');
    })
    .map(file => {
      const fileName = file.split('/').pop() || '';
      let type = 'unknown';
      
      if (fileName.endsWith('.json')) type = 'JSON Config';
      else if (fileName.endsWith('.js')) type = 'JavaScript Config';
      else if (fileName.endsWith('.ts')) type = 'TypeScript Config';
      else if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) type = 'YAML Config';
      
      return { file, type };
    });
}

/**
 * Example 4: Error handling with try-catch (defensive programming)
 */
export function robustFileProcessing(potentiallyProblematicData: unknown): string[] {
  try {
    // Try to process the data
    const normalized = normalizeToArray(potentiallyProblematicData);
    return normalized.map(item => `✓ ${item}`);
  } catch (error) {
    console.warn('Failed to process file data:', error);
    return []; // Return empty array as fallback
  }
}

/**
 * Example 5: Simulating the exact error scenario from user's log
 */
export function simulateUserErrorScenario(): void {
  // This simulates the exact data that caused the user's error
  const problematicGlobResult = "/Users/charslee/Repo/private/claude-code-router/config.json\n/Users/charslee/Repo/private/claude-code-router/tsconfig.json\n/Users/charslee/Repo/private/claude-code-router/jest.config.js\n/Users/charslee/Repo/private/claude-code-router/test-config.js\n/Users/charslee/Repo/private/claude-code-router/test.config.json";
  
  console.log('=== Demonstrating the fix for user\'s error scenario ===');
  console.log('Input (problematic string):', problematicGlobResult);
  
  // ❌ This would cause "A.map is not a function" error:
  // console.log('Direct .map() call:', problematicGlobResult.map(x => x)); // Error!
  
  // ✅ This works correctly:
  const fixedResult = normalizeToArray(problematicGlobResult);
  console.log('Fixed result (array):', fixedResult);
  
  const processedFiles = fixedResult.map(file => ({
    filename: file.split('/').pop(),
    fullPath: file
  }));
  
  console.log('Successfully processed files:', processedFiles);
  console.log('=== Error fixed! ===');
}

// Run the simulation if this file is executed directly
if (require.main === module) {
  simulateUserErrorScenario();
} 