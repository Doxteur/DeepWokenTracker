// Types décrivant un export de build Deepwoken (deepwokenbuilder).
// Tout est optionnel/permissif : les exports varient selon les versions.

export type StatMap = Record<string, number>;

export interface BuildMeta {
  Origin?: string;
  Oath?: string;
  Outfit?: string;
  Race?: string;
  Murmur?: string;
  Bell?: string;
  [key: string]: string | undefined;
}

export interface BuildStats {
  buildName?: string;
  buildDescription?: string;
  buildAuthor?: string;
  traits?: StatMap;
  traitsPoints?: number;
  points?: number;
  pointSpent?: number;
  pointsUntilNextPower?: number;
  power?: number;
  meta?: BuildMeta;
  flaw1?: string;
  flaw2?: string;
  flaw3?: string;
  boon1?: string;
  boon2?: string;
}

export interface Attributes {
  weapon?: StatMap;
  attunement?: StatMap;
  base?: StatMap;
}

export interface Equipment {
  Head?: string | null;
  Arms?: string | null;
  Legs?: string | null;
  Torso?: string | null;
  Face?: string | null;
  Earrings?: string | null;
  Rings?: (string | null)[];
  [key: string]: string | null | (string | null)[] | undefined;
}

export interface BuildMetaInfo {
  views?: number;
  saved?: number;
  tags?: string[];
  visibility?: string;
  votes?: { up?: number; down?: number };
}

export interface DeepwokenBuild {
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  author?: { id?: string; name?: string; verifiedId?: string };
  stats?: BuildStats;
  attributes?: Attributes;
  preShrine?: Attributes;
  postShrine?: Attributes;
  talents?: string[];
  mantras?: string[];
  meta?: BuildMetaInfo;
  equipment?: Equipment;
  weaponStars?: { count?: number; mod?: string };
}
