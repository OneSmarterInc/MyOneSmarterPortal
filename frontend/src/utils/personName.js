export const personName = person => person?.full_name?.trim() || [person?.first_name, person?.last_name].filter(value => value?.trim()).join(' ').trim() || 'Name not provided';
