const ALLOWED_EMAILS = [
  "watsondeacon1@gmail.com",
];

export function isEmailAllowed(email: string): boolean {
  return ALLOWED_EMAILS.includes(email.toLowerCase());
}
