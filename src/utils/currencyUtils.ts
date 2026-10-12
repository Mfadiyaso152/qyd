/**
 * Currency and Number Utilities for Qayd
 */

/**
 * Converts decimal amount (e.g. 120.50) to halalas integer (12050)
 */
export function toHalalas(amount: number | string): number {
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())) : amount;
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Converts halalas integer (12050) to decimal amount (120.50)
 */
export function fromHalalas(halalas: number): number {
  return halalas / 100;
}

/**
 * Formats halalas amount to readable string with currency (e.g. "120.50 ر.س")
 */
export function formatCurrency(halalas: number, numberFormat: 'arabic' | 'english' = 'arabic'): string {
  const amount = fromHalalas(halalas);
  const formattedNumber = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  let result = `${formattedNumber} ر.س`;
  if (numberFormat === 'arabic') {
    // Convert English digits to Arabic-Indic digits if requested
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    result = result.replace(/\d/g, d => arabicDigits[parseInt(d)]);
  }
  return result;
}

/**
 * Parses user input string (handling Arabic or English digits) into decimal number
 */
export function parseAmountInput(input: string): number {
  if (!input) return 0;
  const normalized = input.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).replace(/,/g, '');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}
