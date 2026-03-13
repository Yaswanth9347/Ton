export const DEFAULT_DIESEL_VEHICLES = [
    {
        vehicle_number: 'AP 30 AB 5266',
        truck_type: '4 1/2 Tyre',
        tank_capacity: 220,
        aliases: ['4 1/2 Tyre', '4 ½ Tyre', '41/2 Tyre']
    },
    {
        vehicle_number: 'AP 31 JK 2284',
        truck_type: '6 1/2 Tyre',
        tank_capacity: 220,
        aliases: ['6 1/2 Tyre', '6 ½ Tyre', '61/2 Tyre']
    },
    {
        vehicle_number: 'AP 40 PT 1576',
        truck_type: '10 Tyre',
        tank_capacity: 400,
        aliases: ['10 Tyre']
    }
];

export const normalizeVehicleKey = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/½/g, '1/2')
    .replace(/\s+/g, ' ');
