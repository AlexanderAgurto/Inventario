export function mongoStartupErrorMessage(error) {
  const name = typeof error?.name === 'string' && /^[A-Za-z][A-Za-z0-9]{0,59}$/.test(error.name)
    ? error.name
    : 'Error';

  return `No fue posible conectar con MongoDB (${name}). Compruebe que el servicio esté activo y que MONGODB_URI o MONGO_URI apunte a la base esperada.`;
}
