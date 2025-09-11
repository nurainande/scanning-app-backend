export interface ComparisonResult {
  matches: boolean;
  confidence: number;
  discrepancies: string[];
  matchedText: string[];
  missingText: string[];
}

export class TextComparisonService {
  /**
   * Find products that match the OCR text ingredients
   * Used when no barcode is available
   */
  static findMatchingProductsByIngredients(ocrText: string, products: any[]): any[] {
    const ocrWords = this.normalizeText(ocrText).split(/\s+/);
    const matchingProducts: any[] = [];
    
    for (const product of products) {
      if (!product.expected_ingredients) continue;
      
      const ingredientsComparison = this.compareIngredients(ocrText, product.expected_ingredients);
      
      // If we have a good match (70% or higher), include this product
      if (ingredientsComparison.confidence >= 0.7) {
        matchingProducts.push({
          product,
          matchScore: ingredientsComparison.confidence,
          matchedIngredients: ingredientsComparison.matchedText,
          missingIngredients: ingredientsComparison.missingText
        });
      }
    }
    
    // Sort by match score (highest first)
    return matchingProducts.sort((a, b) => b.matchScore - a.matchScore);
  }
  
  /**
   * Compare OCR text with expected verbage
   */
  static compareVerbage(ocrText: string, expectedVerbage: string): ComparisonResult {
    const ocrWords = this.normalizeText(ocrText).split(/\s+/);
    const expectedWords = this.normalizeText(expectedVerbage).split(/\s+/);
    
    const matchedWords: string[] = [];
    const missingWords: string[] = [];
    const discrepancies: string[] = [];
    
    // Check for missing expected words
    for (const expectedWord of expectedWords) {
      if (expectedWord.length < 3) continue; // Skip short words
      
      const found = ocrWords.some(ocrWord => 
        this.calculateSimilarity(ocrWord, expectedWord) > 0.8
      );
      
      if (found) {
        matchedWords.push(expectedWord);
      } else {
        missingWords.push(expectedWord);
        discrepancies.push(`Missing expected word: "${expectedWord}"`);
      }
    }
    
    const confidence = expectedWords.length > 0 ? matchedWords.length / expectedWords.length : 1;
    const matches = confidence >= 0.8; // 80% match threshold
    
    return {
      matches,
      confidence,
      discrepancies,
      matchedText: matchedWords,
      missingText: missingWords
    };
  }
  
  /**
   * Compare OCR text with expected ingredients
   */
  static compareIngredients(ocrText: string, expectedIngredients: any): ComparisonResult {
    if (!expectedIngredients || !Array.isArray(expectedIngredients)) {
      return {
        matches: true,
        confidence: 1,
        discrepancies: [],
        matchedText: [],
        missingText: []
      };
    }
    
    const ocrWords = this.normalizeText(ocrText).split(/\s+/);
    const expectedIngredientNames = expectedIngredients.map((ingredient: any) => 
      typeof ingredient === 'string' ? ingredient : ingredient.name || ingredient
    );
    
    const matchedIngredients: string[] = [];
    const missingIngredients: string[] = [];
    const discrepancies: string[] = [];
    
    // Check for missing expected ingredients
    for (const ingredient of expectedIngredientNames) {
      const normalizedIngredient = this.normalizeText(ingredient);
      if (normalizedIngredient.length < 3) continue;
      
      const found = ocrWords.some(ocrWord => 
        this.calculateSimilarity(ocrWord, normalizedIngredient) > 0.7
      );
      
      if (found) {
        matchedIngredients.push(ingredient);
      } else {
        missingIngredients.push(ingredient);
        discrepancies.push(`Missing expected ingredient: "${ingredient}"`);
      }
    }
    
    const confidence = expectedIngredientNames.length > 0 ? 
      matchedIngredients.length / expectedIngredientNames.length : 1;
    const matches = confidence >= 0.7; // 70% match threshold for ingredients
    
    return {
      matches,
      confidence,
      discrepancies,
      matchedText: matchedIngredients,
      missingText: missingIngredients
    };
  }
  
  /**
   * Normalize text for comparison (lowercase, remove punctuation, etc.)
   */
  private static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
  
  /**
   * Calculate similarity between two words using Levenshtein distance
   */
  private static calculateSimilarity(word1: string, word2: string): number {
    const longer = word1.length > word2.length ? word1 : word2;
    const shorter = word1.length > word2.length ? word2 : word1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null)
    );
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}
