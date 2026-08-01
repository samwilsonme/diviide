// Shared shapes for the catalog config (public/config.json) and the tool state.

export interface IconData {
  name: string;
  category: string;
  keywords: string[];
  /** Ships a single variant instead of one per color (e.g. the blank space separator). */
  colorless?: boolean;
}

export interface Config {
  colors: Record<string, string>;
  categories: Record<string, string>;
  icons: Record<string, IconData>;
}
