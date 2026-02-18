const ALLOWED_EMAILS = [
  "watsondeacon1@gmail.com",
  "perrykramer51@gmail.com"
];

export function isEmailAllowed(email: string): boolean {
  return ALLOWED_EMAILS.includes(email.toLowerCase());
}
