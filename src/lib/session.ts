const CONTACT_KEY = "tripring_contact";

export function getSessionContact(): string | null {
  try {
    return sessionStorage.getItem(CONTACT_KEY);
  } catch {
    return null;
  }
}

export function setSessionContact(contact: string): void {
  try {
    sessionStorage.setItem(CONTACT_KEY, contact.trim());
  } catch {
    /* ignore */
  }
}
