// ─── Legend Configuration ─────────────────────────────────────────────────────
// Edit here to update how settlement types and landmark categories appear in the
// map legend. Each entry mirrors what is drawn on the map — if you add a new
// settlement type or landmark category in map.js, add a matching entry here.
//
// Settlement types:  city · town · port · village · stronghold · camp · ruin
// Landmark cats:     dungeon · shrine · nature · magical · military · dark · coastal
//
// icon  — inline SVG that visually matches the map icon (≈18 × 18 px rendered)
// desc  — short phrase shown in italic next to the label
// color — label tint used for landmark categories (matches map label colours)

const LEGEND_SETTLEMENTS = {

    city: {
        label: 'City',
        desc:  'Major fortified settlement',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-15 -24 30 28" width="18" height="18">
            <rect x="-13" y="-19" width="8"  height="11" fill="#e4dece" stroke="#333" stroke-width="1"/>
            <rect x="5"   y="-19" width="8"  height="11" fill="#e4dece" stroke="#333" stroke-width="1"/>
            <rect x="-9"  y="-10" width="18" height="12" fill="#e4dece" stroke="#333" stroke-width="1"/>
            <rect x="-13" y="-22" width="2" height="4" fill="#333"/>
            <rect x="-10" y="-22" width="2" height="4" fill="#333"/>
            <rect x="-7"  y="-22" width="2" height="4" fill="#333"/>
            <rect x="5"   y="-22" width="2" height="4" fill="#333"/>
            <rect x="8"   y="-22" width="2" height="4" fill="#333"/>
            <rect x="11"  y="-22" width="2" height="4" fill="#333"/>
        </svg>`,
    },

    town: {
        label: 'Town',
        desc:  'Market town',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-11 -17 22 20" width="18" height="18">
            <rect x="-7" y="-5" width="14" height="9" fill="#eae4d4" stroke="#333" stroke-width="1"/>
            <path d="M -9 -5 L 0 -15 L 9 -5" fill="#eae4d4" stroke="#333" stroke-width="1" stroke-linejoin="round"/>
            <rect x="-2" y="-1" width="4" height="5" fill="#666"/>
        </svg>`,
    },

    port: {
        label: 'Port',
        desc:  'Coastal trading post',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-11 -17 22 22" width="18" height="18">
            <rect x="-10" y="-1" width="20" height="3" fill="#dce8ec" stroke="#1a3a5a" stroke-width="0.9"/>
            <rect x="-7"  y="2"  width="4"  height="5" fill="#dce8ec" stroke="#1a3a5a" stroke-width="0.8"/>
            <rect x="3"   y="2"  width="4"  height="5" fill="#dce8ec" stroke="#1a3a5a" stroke-width="0.8"/>
            <circle cx="0" cy="-14" r="2.5" fill="none" stroke="#1a3a5a" stroke-width="1"/>
            <line x1="0"  y1="-11" x2="0"  y2="-2"  stroke="#1a3a5a" stroke-width="1.2"/>
            <line x1="-5" y1="-9"  x2="5"  y2="-9"  stroke="#1a3a5a" stroke-width="1.2"/>
            <line x1="0"  y1="-2"  x2="-5" y2="1"   stroke="#1a3a5a" stroke-width="1.2"/>
            <line x1="0"  y1="-2"  x2="5"  y2="1"   stroke="#1a3a5a" stroke-width="1.2"/>
        </svg>`,
    },

    village: {
        label: 'Village',
        desc:  'Small hamlet',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-7 -10 14 14" width="18" height="18">
            <rect x="-3.5" y="-2" width="7" height="5" fill="#e8e0cc" stroke="#444" stroke-width="0.7"/>
            <path d="M -5.5 -2 L 0 -8 L 5.5 -2" fill="#e8e0cc" stroke="#444" stroke-width="0.7" stroke-linejoin="round"/>
        </svg>`,
    },

    stronghold: {
        label: 'Stronghold',
        desc:  'Major orcish fortress',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -22 32 26" width="18" height="18">
            <rect x="-14" y="-14" width="28" height="16" fill="#d8c8a8" stroke="#1a1410" stroke-width="1.2"/>
            <rect x="-14"  y="-20" width="3.8" height="7" fill="#1a1410"/>
            <rect x="-8.4" y="-20" width="3.8" height="7" fill="#1a1410"/>
            <rect x="-2.8" y="-20" width="3.8" height="7" fill="#1a1410"/>
            <rect x="2.8"  y="-20" width="3.8" height="7" fill="#1a1410"/>
            <rect x="8.4"  y="-20" width="3.8" height="7" fill="#1a1410"/>
            <path d="M -4 2 L -4 -5 L 0 -10 L 4 -5 L 4 2 Z" fill="#2a1808" stroke="#1a1410" stroke-width="0.6"/>
        </svg>`,
    },

    camp: {
        label: 'Camp',
        desc:  'Warband encampment',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -9 16 17" width="18" height="18">
            <path d="M -6 3 L 0 -7 L 6 3 Z" fill="#c4a870" stroke="#443020" stroke-width="0.7"/>
            <circle cx="0" cy="6" r="1.6" fill="#c04020" opacity="0.85"/>
        </svg>`,
    },

    ruin: {
        label: 'Ruin',
        desc:  'Ancient remains',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -20 28 26" width="18" height="18">
            <rect x="-9"  y="-15" width="5" height="15" fill="#cec8b4" stroke="#555" stroke-width="0.9"/>
            <rect x="4"   y="-9"  width="5" height="9"  fill="#cec8b4" stroke="#555" stroke-width="0.9"/>
            <rect x="-11" y="-17" width="9" height="3"  fill="#cec8b4" stroke="#555" stroke-width="0.7"/>
            <rect x="2"   y="-11" width="9" height="3"  fill="#cec8b4" stroke="#555" stroke-width="0.7"/>
            <rect x="-5" y="2"  width="4" height="3" fill="#bab4a0" stroke="#666" stroke-width="0.5"/>
            <rect x="1"  y="4"  width="4" height="3" fill="#bab4a0" stroke="#666" stroke-width="0.5"/>
            <rect x="5"  y="1"  width="4" height="3" fill="#bab4a0" stroke="#666" stroke-width="0.5"/>
        </svg>`,
    },

};


const LEGEND_LANDMARKS = {

    dungeon: {
        label: 'Dungeon',
        desc:  'Underground complex or cave system',
        color: '#6a4040',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-9 -14 18 22" width="18" height="18">
            <path d="M -7 5 L -7 -2 Q 0 -12 7 -2 L 7 5" fill="none" stroke="#4a3828" stroke-width="1.4"/>
            <line x1="-7" y1="5" x2="7" y2="5" stroke="#4a3828" stroke-width="1.4"/>
        </svg>`,
    },

    shrine: {
        label: 'Shrine',
        desc:  'Sacred site or place of worship',
        color: '#4a4070',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-11 -14 22 20" width="18" height="18">
            <circle cx="0" cy="-3" r="5" fill="none" stroke="#6a5840" stroke-width="1.1"/>
            <line x1="0"    y1="-8"   x2="0"    y2="-11"  stroke="#6a5840" stroke-width="0.8"/>
            <line x1="3.5"  y1="-6.5" x2="5.7"  y2="-8.7" stroke="#6a5840" stroke-width="0.8"/>
            <line x1="5"    y1="-3"   x2="8"    y2="-3"   stroke="#6a5840" stroke-width="0.8"/>
            <line x1="3.5"  y1="0.5"  x2="5.7"  y2="2.7"  stroke="#6a5840" stroke-width="0.8"/>
            <line x1="0"    y1="2"    x2="0"    y2="5"    stroke="#6a5840" stroke-width="0.8"/>
            <line x1="-3.5" y1="0.5"  x2="-5.7" y2="2.7"  stroke="#6a5840" stroke-width="0.8"/>
            <line x1="-5"   y1="-3"   x2="-8"   y2="-3"   stroke="#6a5840" stroke-width="0.8"/>
            <line x1="-3.5" y1="-6.5" x2="-5.7" y2="-8.7" stroke="#6a5840" stroke-width="0.8"/>
        </svg>`,
    },

    nature: {
        label: 'Natural Wonder',
        desc:  'Remarkable natural formation',
        color: '#3a5a30',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -13 16 20" width="18" height="18">
            <path d="M 0 -11 L -6 -4 L -4 5 L 4 5 L 6 -4 Z" fill="none" stroke="#3a6040" stroke-width="1"/>
            <line x1="-6" y1="-4" x2="6" y2="-4" stroke="#3a6040" stroke-width="0.6"/>
        </svg>`,
    },

    magical: {
        label: 'Magical Nexus',
        desc:  'Site of arcane power or ley lines',
        color: '#4a3070',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 16 15" width="18" height="18">
            <path d="M 0 -7 L 1.9 -2.6 L 6.7 -2.2 L 3 1 L 4.1 5.7 L 0 3.2 L -4.1 5.7 L -3 1 L -6.7 -2.2 L -1.9 -2.6 Z"
                fill="none" stroke="#5a4080" stroke-width="1" stroke-linejoin="round"/>
        </svg>`,
    },

    military: {
        label: 'Military Outpost',
        desc:  'Fortified watchpost or garrison',
        color: '#504020',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -12 14 20" width="18" height="18">
            <line x1="0" y1="7" x2="0" y2="-10" stroke="#5a4020" stroke-width="1.2"/>
            <path d="M 0 -10 L 10 -6 L 0 -2 Z" fill="#c04020" stroke="#5a2010" stroke-width="0.6"/>
        </svg>`,
    },

    dark: {
        label: 'Dark Place',
        desc:  'Cursed or corrupted site',
        color: '#502020',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -12 16 18" width="18" height="18">
            <circle cx="0" cy="-5" r="5.5" fill="none" stroke="#483030" stroke-width="1.1"/>
            <circle cx="-2" cy="-6" r="1.2" fill="#483030"/>
            <circle cx="2"  cy="-6" r="1.2" fill="#483030"/>
            <path d="M -4 0 L -4 3 M -1.5 0 L -1.5 3 M 1.5 0 L 1.5 3 M 4 0 L 4 3"
                stroke="#483030" stroke-width="0.9"/>
        </svg>`,
    },

    coastal: {
        label: 'Coastal Landmark',
        desc:  'Lighthouse, sea cave, or tidal wonder',
        color: '#204050',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-9 -12 18 18" width="18" height="18">
            <circle cx="0" cy="-9" r="2.2" fill="none" stroke="#2a4860" stroke-width="1"/>
            <line x1="0"  y1="-7" x2="0"  y2="4"  stroke="#2a4860" stroke-width="1.1"/>
            <line x1="-5" y1="-5" x2="5"  y2="-5" stroke="#2a4860" stroke-width="1.1"/>
            <path d="M -5 1 Q -7 4 0 4 Q 7 4 5 1" fill="none" stroke="#2a4860" stroke-width="1"/>
        </svg>`,
    },

};
