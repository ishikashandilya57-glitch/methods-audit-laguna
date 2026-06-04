export const roadmapMonths = [
  { key: 'jul', label: 'JUL', quarter: 'Q1', period: 'FY 2026-27' },
  { key: 'aug', label: 'AUG', quarter: 'Q1', period: 'FY 2026-27' },
  { key: 'sep', label: 'SEP', quarter: 'Q1', period: 'FY 2026-27' },
  { key: 'oct', label: 'OCT', quarter: 'Q2', period: 'FY 2026-27' },
  { key: 'nov', label: 'NOV', quarter: 'Q2', period: 'FY 2026-27' },
  { key: 'dec', label: 'DEC', quarter: 'Q2', period: 'FY 2026-27' },
  { key: 'jan', label: 'JAN', quarter: 'Q3', period: 'FY 2026-27' },
  { key: 'feb', label: 'FEB', quarter: 'Q3', period: 'FY 2026-27' },
  { key: 'mar', label: 'MAR', quarter: 'Q3', period: 'FY 2026-27' },
  { key: 'apr', label: 'APR', quarter: 'Q4', period: 'FY 2026-27' },
  { key: 'may', label: 'MAY', quarter: 'Q4', period: 'FY 2026-27' },
  { key: 'jun', label: 'JUN', quarter: 'Q4', period: 'FY 2026-27' },
];

export const quarterColumns = [
  { key: 'q1', label: 'Q1', period: 'JUL - SEP 2026' },
  { key: 'q2', label: 'Q2', period: 'OCT - DEC 2026' },
  { key: 'q3', label: 'Q3', period: 'JAN - MAR 2027' },
  { key: 'q4', label: 'Q4', period: 'APR - JUN 2027' },
];

export const baseRoadmapRows = [
  { sno: 1, department: 'SEWING', standardType: 'Standard operations', section: 'ASSEMBLY' },
  { sno: 2, department: 'SEWING', standardType: 'Standard operations', section: 'BACK' },
  { sno: 3, department: 'SEWING', standardType: 'Standard operations', section: 'CUFF' },
  { sno: 4, department: 'SEWING', standardType: 'Standard operations', section: 'COLLAR' },
  { sno: 5, department: 'SEWING', standardType: 'Standard operations', section: 'FRONT' },
  { sno: 6, department: 'SEWING', standardType: 'Standard operations', section: 'SLEEVE' },
  { sno: 7, department: 'SEWING', standardType: 'Non-standard operations', section: 'FRONT' },
  { sno: 8, department: 'SEWING', standardType: 'Non-standard operations', section: 'CUFF' },
  { sno: 9, department: 'SEWING', standardType: 'Non-standard operations', section: 'COLLAR' },
  { sno: 10, department: 'SEWING', standardType: 'Non-standard operations', section: 'FRONT' },
  { sno: 11, department: 'SEWING', standardType: 'Non-standard operations', section: 'BACK' },
  { sno: 12, department: 'SEWING', standardType: 'Non-standard operations', section: 'ASSEMBLY' },
  { sno: 22, department: 'FINISHING', standardType: 'Standard operations', section: 'TRIM & EXAM' },
  { sno: 23, department: 'FINISHING', standardType: 'Standard operations', section: 'EOL CHECKING' },
  { sno: 24, department: 'FINISHING', standardType: 'Standard operations', section: 'FOLDING' },
  { sno: 25, department: 'FINISHING', standardType: 'Standard operations', section: 'PACKAGING' },
  { sno: 26, department: 'FINISHING', standardType: 'Standard operations', section: 'CARTON AUDITING' },
  { sno: 13, department: 'CUTTING', standardType: 'Standard operations', section: 'SPREADING' },
  { sno: 14, department: 'CUTTING', standardType: 'Standard operations', section: 'STRAIGHT KNIFE CUTTING' },
  { sno: 15, department: 'CUTTING', standardType: 'Standard operations', section: 'BAND KNIFE CUTTING' },
  { sno: 16, department: 'CUTTING', standardType: 'Standard operations', section: 'NUMBERING' },
  { sno: 17, department: 'CUTTING', standardType: 'Standard operations', section: 'BUNDLING' },
  { sno: 18, department: 'CUTTING', standardType: 'Standard operations', section: 'FUSING' },
  { sno: 19, department: 'CUTTING', standardType: 'Standard operations', section: 'INSPECTION' },
  { sno: 20, department: 'CUTTING', standardType: 'Non-standard operations', section: 'RELAYING' },
  { sno: 21, department: 'CUTTING', standardType: 'Non-standard operations', section: 'RECUTTING' },
  { sno: 27, department: 'WAREHOUSE', standardType: 'Standard operations', section: 'FABRIC INSPECTION' },
  { sno: 28, department: 'WAREHOUSE', standardType: 'Standard operations', section: 'FABRIC QUARANTINE' },
  { sno: 29, department: 'WAREHOUSE', standardType: 'Standard operations', section: 'FABRIC STORAGE' },
];

export const roadmapMonthKeys = roadmapMonths.map((month) => month.key);

export const createInitialRoadmapRows = () => baseRoadmapRows.map((row) => ({
  ...row,
  status: 'PENDING',
  ...Object.fromEntries(roadmapMonthKeys.map((key) => [key, false])),
}));
