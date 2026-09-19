import { routing } from "i18n/routing";

/** How a country reads in one language: its name, and the article it takes. */
type CountryName = {
  name: string;
  /**
   * The article the name takes in the middle of a sentence, for the names that
   * take one. English gives one to the plural and collective names — "the
   * Netherlands", "the United Kingdom" — and Portuguese gives one to most
   * countries, so the ones recorded without an article here are the ones that
   * take none: "em Portugal", "in Brazil".
   *
   * Which article a name takes is a fact about that name. How a preposition
   * joins it is a rule of the language, and lives in the catalogue under
   * `publication.inCountry`, where a translator can correct it.
   */
  article?: string;
};

/** A country as it is stored and as it is read: the code, and its name. */
type Country = { id: string; label: string };

/**
 * Every country, by ISO 3166-1 alpha-2 code, named in each language the app
 * speaks.
 *
 * This is kept here rather than taken from a library because the two things a
 * country needs are one fact, and no library carries both. A name has to come
 * with the article it takes, or a sentence cannot place it. The Portuguese also
 * has to be Brazilian — the published lists are European, and would have this
 * platform saying Polónia, Irão and Vietname.
 *
 * A code absent from this table has no name to show, and is read as the code
 * itself. Adding one is a row here, in every language.
 */
const COUNTRIES: Record<string, Record<string, CountryName>> = {
  AD: {
    en: { name: "Andorra" },
    pt: { name: "Andorra" },
  },
  AE: {
    en: { name: "United Arab Emirates", article: "the" },
    pt: { name: "Emirados Árabes Unidos", article: "os" },
  },
  AF: {
    en: { name: "Afghanistan" },
    pt: { name: "Afeganistão", article: "o" },
  },
  AG: {
    en: { name: "Antigua and Barbuda" },
    pt: { name: "Antígua e Barbuda" },
  },
  AI: {
    en: { name: "Anguilla" },
    pt: { name: "Anguilla" },
  },
  AL: {
    en: { name: "Albania" },
    pt: { name: "Albânia", article: "a" },
  },
  AM: {
    en: { name: "Armenia" },
    pt: { name: "Armênia", article: "a" },
  },
  AO: {
    en: { name: "Angola" },
    pt: { name: "Angola" },
  },
  AQ: {
    en: { name: "Antarctica" },
    pt: { name: "Antártida", article: "a" },
  },
  AR: {
    en: { name: "Argentina" },
    pt: { name: "Argentina", article: "a" },
  },
  AS: {
    en: { name: "American Samoa" },
    pt: { name: "Samoa Americana" },
  },
  AT: {
    en: { name: "Austria" },
    pt: { name: "Áustria", article: "a" },
  },
  AU: {
    en: { name: "Australia" },
    pt: { name: "Austrália", article: "a" },
  },
  AW: {
    en: { name: "Aruba" },
    pt: { name: "Aruba" },
  },
  AX: {
    en: { name: "Åland Islands", article: "the" },
    pt: { name: "Ilhas Åland", article: "as" },
  },
  AZ: {
    en: { name: "Azerbaijan" },
    pt: { name: "Azerbaijão", article: "o" },
  },
  BA: {
    en: { name: "Bosnia and Herzegovina" },
    pt: { name: "Bósnia e Herzegovina", article: "a" },
  },
  BB: {
    en: { name: "Barbados" },
    pt: { name: "Barbados" },
  },
  BD: {
    en: { name: "Bangladesh" },
    pt: { name: "Bangladesh", article: "o" },
  },
  BE: {
    en: { name: "Belgium" },
    pt: { name: "Bélgica", article: "a" },
  },
  BF: {
    en: { name: "Burkina Faso" },
    pt: { name: "Burkina Faso", article: "o" },
  },
  BG: {
    en: { name: "Bulgaria" },
    pt: { name: "Bulgária", article: "a" },
  },
  BH: {
    en: { name: "Bahrain" },
    pt: { name: "Bahrein", article: "o" },
  },
  BI: {
    en: { name: "Burundi" },
    pt: { name: "Burundi", article: "o" },
  },
  BJ: {
    en: { name: "Benin" },
    pt: { name: "Benin" },
  },
  BL: {
    en: { name: "Saint Barthélemy" },
    pt: { name: "São Bartolomeu" },
  },
  BM: {
    en: { name: "Bermuda" },
    pt: { name: "Bermudas", article: "as" },
  },
  BN: {
    en: { name: "Brunei" },
    pt: { name: "Brunei" },
  },
  BO: {
    en: { name: "Bolivia" },
    pt: { name: "Bolívia", article: "a" },
  },
  BQ: {
    en: { name: "Bonaire, Sint Eustatius and Saba" },
    pt: { name: "Países Baixos Caribenhos", article: "os" },
  },
  BR: {
    en: { name: "Brazil" },
    pt: { name: "Brasil", article: "o" },
  },
  BS: {
    en: { name: "Bahamas", article: "the" },
    pt: { name: "Bahamas", article: "as" },
  },
  BT: {
    en: { name: "Bhutan" },
    pt: { name: "Butão", article: "o" },
  },
  BV: {
    en: { name: "Bouvet Island" },
    pt: { name: "Ilha Bouvet", article: "a" },
  },
  BW: {
    en: { name: "Botswana" },
    pt: { name: "Botsuana", article: "o" },
  },
  BY: {
    en: { name: "Belarus" },
    pt: { name: "Belarus", article: "a" },
  },
  BZ: {
    en: { name: "Belize" },
    pt: { name: "Belize" },
  },
  CA: {
    en: { name: "Canada" },
    pt: { name: "Canadá", article: "o" },
  },
  CC: {
    en: { name: "Cocos (Keeling) Islands", article: "the" },
    pt: { name: "Ilhas Cocos", article: "as" },
  },
  CD: {
    en: { name: "Democratic Republic of the Congo", article: "the" },
    pt: { name: "República Democrática do Congo", article: "a" },
  },
  CF: {
    en: { name: "Central African Republic", article: "the" },
    pt: { name: "República Centro-Africana", article: "a" },
  },
  CG: {
    en: { name: "Congo" },
    pt: { name: "Congo", article: "o" },
  },
  CH: {
    en: { name: "Switzerland" },
    pt: { name: "Suíça", article: "a" },
  },
  CI: {
    en: { name: "Côte d'Ivoire" },
    pt: { name: "Costa do Marfim", article: "a" },
  },
  CK: {
    en: { name: "Cook Islands", article: "the" },
    pt: { name: "Ilhas Cook", article: "as" },
  },
  CL: {
    en: { name: "Chile" },
    pt: { name: "Chile", article: "o" },
  },
  CM: {
    en: { name: "Cameroon" },
    pt: { name: "Camarões", article: "os" },
  },
  CN: {
    en: { name: "China" },
    pt: { name: "China", article: "a" },
  },
  CO: {
    en: { name: "Colombia" },
    pt: { name: "Colômbia", article: "a" },
  },
  CR: {
    en: { name: "Costa Rica" },
    pt: { name: "Costa Rica", article: "a" },
  },
  CU: {
    en: { name: "Cuba" },
    pt: { name: "Cuba" },
  },
  CV: {
    en: { name: "Cape Verde" },
    pt: { name: "Cabo Verde" },
  },
  CW: {
    en: { name: "Curaçao" },
    pt: { name: "Curaçao" },
  },
  CX: {
    en: { name: "Christmas Island" },
    pt: { name: "Ilha Christmas", article: "a" },
  },
  CY: {
    en: { name: "Cyprus" },
    pt: { name: "Chipre", article: "o" },
  },
  CZ: {
    en: { name: "Czech Republic", article: "the" },
    pt: { name: "República Tcheca", article: "a" },
  },
  DE: {
    en: { name: "Germany" },
    pt: { name: "Alemanha", article: "a" },
  },
  DJ: {
    en: { name: "Djibouti" },
    pt: { name: "Djibuti", article: "o" },
  },
  DK: {
    en: { name: "Denmark" },
    pt: { name: "Dinamarca", article: "a" },
  },
  DM: {
    en: { name: "Dominica" },
    pt: { name: "Dominica" },
  },
  DO: {
    en: { name: "Dominican Republic", article: "the" },
    pt: { name: "República Dominicana", article: "a" },
  },
  DZ: {
    en: { name: "Algeria" },
    pt: { name: "Argélia", article: "a" },
  },
  EC: {
    en: { name: "Ecuador" },
    pt: { name: "Equador", article: "o" },
  },
  EE: {
    en: { name: "Estonia" },
    pt: { name: "Estônia", article: "a" },
  },
  EG: {
    en: { name: "Egypt" },
    pt: { name: "Egito", article: "o" },
  },
  EH: {
    en: { name: "Western Sahara" },
    pt: { name: "Saara Ocidental", article: "o" },
  },
  ER: {
    en: { name: "Eritrea" },
    pt: { name: "Eritreia", article: "a" },
  },
  ES: {
    en: { name: "Spain" },
    pt: { name: "Espanha", article: "a" },
  },
  ET: {
    en: { name: "Ethiopia" },
    pt: { name: "Etiópia", article: "a" },
  },
  FI: {
    en: { name: "Finland" },
    pt: { name: "Finlândia", article: "a" },
  },
  FJ: {
    en: { name: "Fiji" },
    pt: { name: "Fiji" },
  },
  FK: {
    en: { name: "Falkland Islands (Malvinas)", article: "the" },
    pt: { name: "Ilhas Malvinas", article: "as" },
  },
  FM: {
    en: { name: "Micronesia" },
    pt: { name: "Micronésia", article: "a" },
  },
  FO: {
    en: { name: "Faroe Islands", article: "the" },
    pt: { name: "Ilhas Faroé", article: "as" },
  },
  FR: {
    en: { name: "France" },
    pt: { name: "França", article: "a" },
  },
  GA: {
    en: { name: "Gabon" },
    pt: { name: "Gabão", article: "o" },
  },
  GB: {
    en: { name: "United Kingdom", article: "the" },
    pt: { name: "Reino Unido", article: "o" },
  },
  GD: {
    en: { name: "Grenada" },
    pt: { name: "Granada" },
  },
  GE: {
    en: { name: "Georgia" },
    pt: { name: "Geórgia", article: "a" },
  },
  GF: {
    en: { name: "French Guiana" },
    pt: { name: "Guiana Francesa", article: "a" },
  },
  GG: {
    en: { name: "Guernsey" },
    pt: { name: "Guernsey" },
  },
  GH: {
    en: { name: "Ghana" },
    pt: { name: "Gana", article: "o" },
  },
  GI: {
    en: { name: "Gibraltar" },
    pt: { name: "Gibraltar" },
  },
  GL: {
    en: { name: "Greenland" },
    pt: { name: "Groenlândia", article: "a" },
  },
  GM: {
    en: { name: "Republic of The Gambia", article: "the" },
    pt: { name: "Gâmbia", article: "a" },
  },
  GN: {
    en: { name: "Guinea" },
    pt: { name: "Guiné", article: "a" },
  },
  GP: {
    en: { name: "Guadeloupe" },
    pt: { name: "Guadalupe" },
  },
  GQ: {
    en: { name: "Equatorial Guinea" },
    pt: { name: "Guiné Equatorial", article: "a" },
  },
  GR: {
    en: { name: "Greece" },
    pt: { name: "Grécia", article: "a" },
  },
  GS: {
    en: { name: "South Georgia" },
    pt: { name: "Geórgia do Sul e Ilhas Sandwich do Sul" },
  },
  GT: {
    en: { name: "Guatemala" },
    pt: { name: "Guatemala", article: "a" },
  },
  GU: {
    en: { name: "Guam" },
    pt: { name: "Guam" },
  },
  GW: {
    en: { name: "Guinea-Bissau" },
    pt: { name: "Guiné-Bissau", article: "a" },
  },
  GY: {
    en: { name: "Guyana" },
    pt: { name: "Guiana", article: "a" },
  },
  HK: {
    en: { name: "Hong Kong" },
    pt: { name: "Hong Kong", article: "a" },
  },
  HM: {
    en: { name: "Heard Island and McDonald Islands", article: "the" },
    pt: { name: "Ilha Heard e Ilhas McDonald", article: "a" },
  },
  HN: {
    en: { name: "Honduras" },
    pt: { name: "Honduras" },
  },
  HR: {
    en: { name: "Croatia" },
    pt: { name: "Croácia", article: "a" },
  },
  HT: {
    en: { name: "Haiti" },
    pt: { name: "Haiti", article: "o" },
  },
  HU: {
    en: { name: "Hungary" },
    pt: { name: "Hungria", article: "a" },
  },
  ID: {
    en: { name: "Indonesia" },
    pt: { name: "Indonésia", article: "a" },
  },
  IE: {
    en: { name: "Ireland" },
    pt: { name: "Irlanda", article: "a" },
  },
  IL: {
    en: { name: "Israel" },
    pt: { name: "Israel" },
  },
  IM: {
    en: { name: "Isle of Man" },
    pt: { name: "Ilha de Man", article: "a" },
  },
  IN: {
    en: { name: "India" },
    pt: { name: "Índia", article: "a" },
  },
  IO: {
    en: { name: "British Indian Ocean Territory", article: "the" },
    pt: { name: "Território Britânico do Oceano Índico" },
  },
  IQ: {
    en: { name: "Iraq" },
    pt: { name: "Iraque", article: "o" },
  },
  IR: {
    en: { name: "Iran" },
    pt: { name: "Irã", article: "o" },
  },
  IS: {
    en: { name: "Iceland" },
    pt: { name: "Islândia", article: "a" },
  },
  IT: {
    en: { name: "Italy" },
    pt: { name: "Itália", article: "a" },
  },
  JE: {
    en: { name: "Jersey" },
    pt: { name: "Jersey" },
  },
  JM: {
    en: { name: "Jamaica" },
    pt: { name: "Jamaica", article: "a" },
  },
  JO: {
    en: { name: "Jordan" },
    pt: { name: "Jordânia", article: "a" },
  },
  JP: {
    en: { name: "Japan" },
    pt: { name: "Japão", article: "o" },
  },
  KE: {
    en: { name: "Kenya" },
    pt: { name: "Quênia", article: "o" },
  },
  KG: {
    en: { name: "Kyrgyzstan" },
    pt: { name: "Quirguistão", article: "o" },
  },
  KH: {
    en: { name: "Cambodia" },
    pt: { name: "Camboja", article: "o" },
  },
  KI: {
    en: { name: "Kiribati" },
    pt: { name: "Kiribati" },
  },
  KM: {
    en: { name: "Comoros", article: "the" },
    pt: { name: "Comores", article: "as" },
  },
  KN: {
    en: { name: "Saint Kitts and Nevis" },
    pt: { name: "São Cristóvão e Neves" },
  },
  KP: {
    en: { name: "North Korea" },
    pt: { name: "Coreia do Norte", article: "a" },
  },
  KR: {
    en: { name: "South Korea" },
    pt: { name: "Coreia do Sul", article: "a" },
  },
  KW: {
    en: { name: "Kuwait" },
    pt: { name: "Kuwait", article: "o" },
  },
  KY: {
    en: { name: "Cayman Islands", article: "the" },
    pt: { name: "Ilhas Cayman", article: "as" },
  },
  KZ: {
    en: { name: "Kazakhstan" },
    pt: { name: "Cazaquistão", article: "o" },
  },
  LA: {
    en: { name: "Laos" },
    pt: { name: "Laos", article: "o" },
  },
  LB: {
    en: { name: "Lebanon" },
    pt: { name: "Líbano", article: "o" },
  },
  LC: {
    en: { name: "Saint Lucia" },
    pt: { name: "Santa Lúcia" },
  },
  LI: {
    en: { name: "Liechtenstein" },
    pt: { name: "Liechtenstein" },
  },
  LK: {
    en: { name: "Sri Lanka" },
    pt: { name: "Sri Lanka", article: "o" },
  },
  LR: {
    en: { name: "Liberia" },
    pt: { name: "Libéria", article: "a" },
  },
  LS: {
    en: { name: "Lesotho" },
    pt: { name: "Lesoto", article: "o" },
  },
  LT: {
    en: { name: "Lithuania" },
    pt: { name: "Lituânia", article: "a" },
  },
  LU: {
    en: { name: "Luxembourg" },
    pt: { name: "Luxemburgo", article: "o" },
  },
  LV: {
    en: { name: "Latvia" },
    pt: { name: "Letônia", article: "a" },
  },
  LY: {
    en: { name: "Libya" },
    pt: { name: "Líbia", article: "a" },
  },
  MA: {
    en: { name: "Morocco" },
    pt: { name: "Marrocos", article: "o" },
  },
  MC: {
    en: { name: "Monaco" },
    pt: { name: "Mônaco", article: "o" },
  },
  MD: {
    en: { name: "Moldova" },
    pt: { name: "Moldávia", article: "a" },
  },
  ME: {
    en: { name: "Montenegro" },
    pt: { name: "Montenegro", article: "o" },
  },
  MF: {
    en: { name: "Saint Martin (French part)" },
    pt: { name: "São Martinho" },
  },
  MG: {
    en: { name: "Madagascar" },
    pt: { name: "Madagascar", article: "o" },
  },
  MH: {
    en: { name: "Marshall Islands", article: "the" },
    pt: { name: "Ilhas Marshall", article: "as" },
  },
  MK: {
    en: { name: "North Macedonia" },
    pt: { name: "Macedônia do Norte", article: "a" },
  },
  ML: {
    en: { name: "Mali" },
    pt: { name: "Mali", article: "o" },
  },
  MM: {
    en: { name: "Myanmar" },
    pt: { name: "Mianmar", article: "o" },
  },
  MN: {
    en: { name: "Mongolia" },
    pt: { name: "Mongólia", article: "a" },
  },
  MO: {
    en: { name: "Macao" },
    pt: { name: "Macau", article: "a" },
  },
  MP: {
    en: { name: "Northern Mariana Islands", article: "the" },
    pt: { name: "Ilhas Marianas do Norte", article: "as" },
  },
  MQ: {
    en: { name: "Martinique" },
    pt: { name: "Martinica", article: "a" },
  },
  MR: {
    en: { name: "Mauritania" },
    pt: { name: "Mauritânia", article: "a" },
  },
  MS: {
    en: { name: "Montserrat" },
    pt: { name: "Montserrat" },
  },
  MT: {
    en: { name: "Malta" },
    pt: { name: "Malta" },
  },
  MU: {
    en: { name: "Mauritius" },
    pt: { name: "Maurício" },
  },
  MV: {
    en: { name: "Maldives", article: "the" },
    pt: { name: "Maldivas", article: "as" },
  },
  MW: {
    en: { name: "Malawi" },
    pt: { name: "Malauí", article: "o" },
  },
  MX: {
    en: { name: "Mexico" },
    pt: { name: "México", article: "o" },
  },
  MY: {
    en: { name: "Malaysia" },
    pt: { name: "Malásia", article: "a" },
  },
  MZ: {
    en: { name: "Mozambique" },
    pt: { name: "Moçambique" },
  },
  NA: {
    en: { name: "Namibia" },
    pt: { name: "Namíbia", article: "a" },
  },
  NC: {
    en: { name: "New Caledonia" },
    pt: { name: "Nova Caledônia", article: "a" },
  },
  NE: {
    en: { name: "Niger" },
    pt: { name: "Níger", article: "o" },
  },
  NF: {
    en: { name: "Norfolk Island" },
    pt: { name: "Ilha Norfolk", article: "a" },
  },
  NG: {
    en: { name: "Nigeria" },
    pt: { name: "Nigéria", article: "a" },
  },
  NI: {
    en: { name: "Nicaragua" },
    pt: { name: "Nicarágua", article: "a" },
  },
  NL: {
    en: { name: "Netherlands", article: "the" },
    pt: { name: "Países Baixos", article: "os" },
  },
  NO: {
    en: { name: "Norway" },
    pt: { name: "Noruega", article: "a" },
  },
  NP: {
    en: { name: "Nepal" },
    pt: { name: "Nepal", article: "o" },
  },
  NR: {
    en: { name: "Nauru" },
    pt: { name: "Nauru" },
  },
  NU: {
    en: { name: "Niue" },
    pt: { name: "Niue" },
  },
  NZ: {
    en: { name: "New Zealand" },
    pt: { name: "Nova Zelândia", article: "a" },
  },
  OM: {
    en: { name: "Oman" },
    pt: { name: "Omã", article: "o" },
  },
  PA: {
    en: { name: "Panama" },
    pt: { name: "Panamá", article: "o" },
  },
  PE: {
    en: { name: "Peru" },
    pt: { name: "Peru", article: "o" },
  },
  PF: {
    en: { name: "French Polynesia" },
    pt: { name: "Polinésia Francesa", article: "a" },
  },
  PG: {
    en: { name: "Papua New Guinea" },
    pt: { name: "Papua-Nova Guiné", article: "a" },
  },
  PH: {
    en: { name: "Philippines", article: "the" },
    pt: { name: "Filipinas", article: "as" },
  },
  PK: {
    en: { name: "Pakistan" },
    pt: { name: "Paquistão", article: "o" },
  },
  PL: {
    en: { name: "Poland" },
    pt: { name: "Polônia", article: "a" },
  },
  PM: {
    en: { name: "Saint Pierre and Miquelon" },
    pt: { name: "São Pedro e Miquelon" },
  },
  PN: {
    en: { name: "Pitcairn" },
    pt: { name: "Ilhas Pitcairn", article: "as" },
  },
  PR: {
    en: { name: "Puerto Rico" },
    pt: { name: "Porto Rico", article: "o" },
  },
  PS: {
    en: { name: "Palestine" },
    pt: { name: "Palestina", article: "a" },
  },
  PT: {
    en: { name: "Portugal" },
    pt: { name: "Portugal" },
  },
  PW: {
    en: { name: "Palau" },
    pt: { name: "Palau" },
  },
  PY: {
    en: { name: "Paraguay" },
    pt: { name: "Paraguai", article: "o" },
  },
  QA: {
    en: { name: "Qatar" },
    pt: { name: "Catar", article: "o" },
  },
  RE: {
    en: { name: "Reunion" },
    pt: { name: "Reunião", article: "a" },
  },
  RO: {
    en: { name: "Romania" },
    pt: { name: "Romênia", article: "a" },
  },
  RS: {
    en: { name: "Serbia" },
    pt: { name: "Sérvia", article: "a" },
  },
  RU: {
    en: { name: "Russia" },
    pt: { name: "Rússia", article: "a" },
  },
  RW: {
    en: { name: "Rwanda" },
    pt: { name: "Ruanda", article: "a" },
  },
  SA: {
    en: { name: "Saudi Arabia" },
    pt: { name: "Arábia Saudita", article: "a" },
  },
  SB: {
    en: { name: "Solomon Islands", article: "the" },
    pt: { name: "Ilhas Salomão", article: "as" },
  },
  SC: {
    en: { name: "Seychelles", article: "the" },
    pt: { name: "Seicheles", article: "as" },
  },
  SD: {
    en: { name: "Sudan", article: "the" },
    pt: { name: "Sudão", article: "o" },
  },
  SE: {
    en: { name: "Sweden" },
    pt: { name: "Suécia", article: "a" },
  },
  SG: {
    en: { name: "Singapore" },
    pt: { name: "Singapura" },
  },
  SH: {
    en: { name: "Saint Helena" },
    pt: { name: "Santa Helena" },
  },
  SI: {
    en: { name: "Slovenia" },
    pt: { name: "Eslovênia", article: "a" },
  },
  SJ: {
    en: { name: "Svalbard and Jan Mayen" },
    pt: { name: "Svalbard e Jan Mayen" },
  },
  SK: {
    en: { name: "Slovakia" },
    pt: { name: "Eslováquia", article: "a" },
  },
  SL: {
    en: { name: "Sierra Leone" },
    pt: { name: "Serra Leoa", article: "a" },
  },
  SM: {
    en: { name: "San Marino" },
    pt: { name: "San Marino" },
  },
  SN: {
    en: { name: "Senegal" },
    pt: { name: "Senegal", article: "o" },
  },
  SO: {
    en: { name: "Somalia" },
    pt: { name: "Somália", article: "a" },
  },
  SR: {
    en: { name: "Suriname" },
    pt: { name: "Suriname", article: "o" },
  },
  SS: {
    en: { name: "South Sudan", article: "the" },
    pt: { name: "Sudão do Sul", article: "o" },
  },
  ST: {
    en: { name: "Sao Tome and Principe" },
    pt: { name: "São Tomé e Príncipe" },
  },
  SV: {
    en: { name: "El Salvador" },
    pt: { name: "El Salvador", article: "o" },
  },
  SX: {
    en: { name: "Sint Maarten (Dutch part)" },
    pt: { name: "São Martinho" },
  },
  SY: {
    en: { name: "Syria" },
    pt: { name: "Síria", article: "a" },
  },
  SZ: {
    en: { name: "Eswatini" },
    pt: { name: "Essuatíni", article: "a" },
  },
  TC: {
    en: { name: "Turks and Caicos Islands", article: "the" },
    pt: { name: "Ilhas Turcas e Caicos", article: "as" },
  },
  TD: {
    en: { name: "Chad" },
    pt: { name: "Chade", article: "o" },
  },
  TF: {
    en: { name: "French Southern Territories" },
    pt: { name: "Terras Austrais e Antárticas Francesas" },
  },
  TG: {
    en: { name: "Togo" },
    pt: { name: "Togo", article: "o" },
  },
  TH: {
    en: { name: "Thailand" },
    pt: { name: "Tailândia", article: "a" },
  },
  TJ: {
    en: { name: "Tajikistan" },
    pt: { name: "Tajiquistão", article: "o" },
  },
  TK: {
    en: { name: "Tokelau" },
    pt: { name: "Tokelau" },
  },
  TL: {
    en: { name: "Timor-Leste" },
    pt: { name: "Timor-Leste" },
  },
  TM: {
    en: { name: "Turkmenistan" },
    pt: { name: "Turcomenistão", article: "o" },
  },
  TN: {
    en: { name: "Tunisia" },
    pt: { name: "Tunísia", article: "a" },
  },
  TO: {
    en: { name: "Tonga" },
    pt: { name: "Tonga" },
  },
  TR: {
    en: { name: "Türkiye" },
    pt: { name: "Turquia", article: "a" },
  },
  TT: {
    en: { name: "Trinidad and Tobago" },
    pt: { name: "Trindade e Tobago" },
  },
  TV: {
    en: { name: "Tuvalu" },
    pt: { name: "Tuvalu" },
  },
  TW: {
    en: { name: "Taiwan" },
    pt: { name: "Taiwan", article: "a" },
  },
  TZ: {
    en: { name: "Tanzania" },
    pt: { name: "Tanzânia", article: "a" },
  },
  UA: {
    en: { name: "Ukraine" },
    pt: { name: "Ucrânia", article: "a" },
  },
  UG: {
    en: { name: "Uganda" },
    pt: { name: "Uganda", article: "a" },
  },
  UM: {
    en: { name: "United States Minor Outlying Islands", article: "the" },
    pt: { name: "Ilhas Menores Distantes dos EUA", article: "as" },
  },
  US: {
    en: { name: "United States", article: "the" },
    pt: { name: "Estados Unidos", article: "os" },
  },
  UY: {
    en: { name: "Uruguay" },
    pt: { name: "Uruguai", article: "o" },
  },
  UZ: {
    en: { name: "Uzbekistan" },
    pt: { name: "Uzbequistão", article: "o" },
  },
  VA: {
    en: { name: "Vatican City", article: "the" },
    pt: { name: "Santa Sé", article: "o" },
  },
  VC: {
    en: { name: "Saint Vincent and the Grenadines" },
    pt: { name: "São Vicente e Granadinas" },
  },
  VE: {
    en: { name: "Venezuela" },
    pt: { name: "Venezuela", article: "a" },
  },
  VG: {
    en: { name: "British Virgin Islands", article: "the" },
    pt: { name: "Ilhas Virgens Britânicas", article: "as" },
  },
  VI: {
    en: { name: "US Virgin Islands", article: "the" },
    pt: { name: "Ilhas Virgens Americanas", article: "as" },
  },
  VN: {
    en: { name: "Vietnam" },
    pt: { name: "Vietnã", article: "o" },
  },
  VU: {
    en: { name: "Vanuatu" },
    pt: { name: "Vanuatu" },
  },
  WF: {
    en: { name: "Wallis and Futuna" },
    pt: { name: "Wallis e Futuna" },
  },
  WS: {
    en: { name: "Samoa" },
    pt: { name: "Samoa" },
  },
  XK: {
    en: { name: "Kosovo" },
    pt: { name: "Kosovo", article: "o" },
  },
  YE: {
    en: { name: "Yemen" },
    pt: { name: "Iêmen", article: "o" },
  },
  YT: {
    en: { name: "Mayotte" },
    pt: { name: "Mayotte" },
  },
  ZA: {
    en: { name: "South Africa" },
    pt: { name: "África do Sul", article: "a" },
  },
  ZM: {
    en: { name: "Zambia" },
    pt: { name: "Zâmbia", article: "a" },
  },
  ZW: {
    en: { name: "Zimbabwe" },
    pt: { name: "Zimbábue", article: "o" },
  },
};

// Every cell holding a country asks for the list, so each language is shaped
// once and kept.
const BY_LOCALE = new Map<string, Record<Country["id"], Country>>();

/** The language to read names in, falling back the way the catalogue does. */
function language(locale: string): string {
  return locale in (COUNTRIES.BR ?? {}) ? locale : routing.defaultLocale;
}

/**
 * Every country, keyed by its ISO alpha-2 code and named in `locale`.
 *
 * A country is stored as its code and read as its name, and which name that is
 * depends on the language the page is in, so the language is asked for rather
 * than assumed.
 */
function countriesIn(locale: string): Record<Country["id"], Country> {
  const read = language(locale);

  const built = BY_LOCALE.get(read);
  if (built) return built;

  const names = Object.entries(COUNTRIES).reduce(
    (all, [id, named]) => ({ ...all, [id]: { id, label: named[read].name } }),
    {} as Record<Country["id"], Country>,
  );

  BY_LOCALE.set(read, names);
  return names;
}

/** What a country code is called in `locale`, or nothing where it names none. */
function countryName(code: string, locale: string): string | undefined {
  return COUNTRIES[code]?.[language(locale)]?.name;
}

/**
 * The article `code` takes in `locale`, or an empty string where its name takes
 * none. What a caller does with it is `publication.inCountry`'s business.
 */
function countryArticle(code: string, locale: string): string {
  return COUNTRIES[code]?.[language(locale)]?.article ?? "";
}

export type { Country };
export { countriesIn, countryArticle, countryName };
