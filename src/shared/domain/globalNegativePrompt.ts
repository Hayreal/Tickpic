/** Built-in global negative prompt for new installs and settings reset. */
export const DEFAULT_GLOBAL_NEGATIVE_PROMPT = [
  '1.请不要带有不合规的环保声明。包括但不限于以下词汇：eco-friendly、environmental friendly、 eco-、recycleable、sustainable、biodegradable等',
  '2.请不要声明清洁、去污、防霉除霉相关功能，否则请提供EU-Detergent资质。包括但不限于以下词汇：Mold/Mould、Mildew、Fungus、 Mold-Resistant / Mildew-Resistant、 Mold-Proof / Mildew-Proof、Fungicidal、Mildewcidal、 Fungistatic、 Antifungal、 Antimicrobial、Biocide等',
  '3.不能出现 non-toxic, non-harmful, non-polluting, ecologica',
].join('\n');
