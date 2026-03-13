export const DEFAULT_GOVT_SPARE_MATERIALS = [
    {
        syncKey: 'borecap_qty',
        spare_name: 'Bore Cap',
        category: 'MATERIAL',
        unit_type: 'Piece',
        reorder_level: 5,
    },
    {
        syncKey: 'cylinders_qty',
        spare_name: 'Cylinders',
        category: 'MATERIAL',
        unit_type: 'Piece',
        reorder_level: 2,
    },
    {
        syncKey: 'erection_qty',
        spare_name: 'Erection',
        category: 'MATERIAL',
        unit_type: 'Unit',
        reorder_level: 2,
    },
    {
        syncKey: 'head_handle_qty',
        spare_name: 'Head Handle',
        category: 'MATERIAL',
        unit_type: 'Piece',
        reorder_level: 2,
    },
    {
        syncKey: 'plotfarm_qty',
        spare_name: 'Plot Farm',
        category: 'MATERIAL',
        unit_type: 'Unit',
        reorder_level: 2,
    },
    {
        syncKey: 'pumpset_qty',
        spare_name: 'Pump Set',
        category: 'MATERIAL',
        unit_type: 'Piece',
        reorder_level: 2,
    },
    {
        syncKey: 'slotting_qty',
        spare_name: 'Slotting',
        category: 'MATERIAL',
        unit_type: 'Piece',
        reorder_level: 5,
    },
    {
        syncKey: 'stand_qty',
        spare_name: 'Stand',
        category: 'MATERIAL',
        unit_type: 'Piece',
        reorder_level: 2,
    },
];

export const DEFAULT_GOVT_SPARE_BY_SYNC_KEY = Object.fromEntries(
    DEFAULT_GOVT_SPARE_MATERIALS.map((item) => [item.syncKey, item])
);

export const DEFAULT_GOVT_SPARE_NAMES = DEFAULT_GOVT_SPARE_MATERIALS.map((item) => item.spare_name);
