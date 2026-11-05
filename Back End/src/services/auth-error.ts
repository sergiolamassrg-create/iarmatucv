export class AuthError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export function cognitoError(error: unknown): AuthError | null {
  if (error instanceof AuthError) return error;
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : '';
  if ((name === 'NotAuthorizedException' && /SECRET_HASH|secret.?hash|configured with secret/i.test(message)) ||
      (name === 'InvalidParameterException' && /auth flow.*not enabled|flow.*not enabled/i.test(message))) {
    console.error('Cognito: revisar el Client Secret y los flujos habilitados del app client.');
    return new AuthError(503, 'CONFIGURACION_DE_ACCESO_INVALIDA', 'No pudimos conectar con el servicio de acceso. Intentá nuevamente más tarde.');
  }
  if (name === 'InvalidParameterException') {
    if (/unauthorized attribute|not.*authorized.*attribute/i.test(message)) {
      console.error('Cognito: el app client no permite escribir los atributos del registro.');
      return new AuthError(503, 'ATRIBUTOS_NO_PERMITIDOS', 'El registro no está disponible en este momento. Intentá nuevamente más tarde.');
    }
    if (/schema|attribute.*required|required.*attribute/i.test(message)) {
      return new AuthError(400, 'DATOS_DE_CUENTA_INCOMPLETOS', 'Completá tu nombre, apellido y nombre para mostrar antes de crear la cuenta.');
    }
    if (/password/i.test(message)) {
      return new AuthError(400, 'CONTRASENA_INVALIDA', 'Revisá la contraseña: no debe comenzar ni terminar con espacios y debe cumplir los requisitos de la cuenta.');
    }
    return new AuthError(400, 'DATOS_INVALIDOS', 'Revisá los datos ingresados y volvé a intentar.');
  }
  switch (name) {
    case 'NotAuthorizedException':
    case 'UserNotFoundException':
      return new AuthError(401, 'ACCESO_INVALIDO', 'No pudimos validar el acceso. Revisá tus datos e intentá nuevamente.');
    case 'UserNotConfirmedException':
      return new AuthError(409, 'CUENTA_SIN_CONFIRMAR', 'Confirmá tu correo para poder ingresar.');
    case 'UsernameExistsException':
      return new AuthError(409, 'CUENTA_EXISTENTE', 'No pudimos crear la cuenta. Si ya te registraste, iniciá sesión o recuperá tu contraseña.');
    case 'InvalidPasswordException':
    case 'PasswordHistoryPolicyViolationException':
      return new AuthError(400, 'CONTRASENA_INVALIDA', 'La contraseña no cumple los requisitos de tu cuenta. Probá una más larga con mayúsculas, minúsculas, números y símbolos.');
    case 'CodeMismatchException':
      return new AuthError(400, 'CODIGO_INVALIDO', 'El código no es correcto. Revisalo e intentá nuevamente.');
    case 'ExpiredCodeException':
      return new AuthError(400, 'CODIGO_VENCIDO', 'El código venció. Solicitá uno nuevo.');
    case 'TooManyRequestsException':
    case 'LimitExceededException':
    case 'TooManyFailedAttemptsException':
      return new AuthError(429, 'DEMASIADOS_INTENTOS', 'Hubo demasiados intentos. Esperá unos minutos antes de volver a intentar.');
    case 'PasswordResetRequiredException':
      return new AuthError(409, 'RECUPERACION_REQUERIDA', 'Necesitás recuperar tu contraseña antes de ingresar.');
    case 'InvalidEmailRoleAccessPolicyException':
    case 'CodeDeliveryFailureException':
    case 'ResourceNotFoundException':
    case 'TimeoutError':
    case 'NetworkingError':
      return new AuthError(503, 'ACCESO_NO_DISPONIBLE', 'El acceso no está disponible en este momento. Intentá nuevamente más tarde.');
    default:
      return null;
  }
}
