const CONTACT_KEY = "tripring_contact";
const LAST_BOOKING_KEY = "tripring_last_booking";

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

// Remembers the most recent booking (number + contact) so that if the
// ConfirmationPage loses its in-memory location.state (e.g. the user
// refreshes the page), we can still offer to look the booking back up
// instead of the booking appearing lost.
export function setLastBooking(bookingNumber: string, contact: string): void {
  try {
    sessionStorage.setItem(LAST_BOOKING_KEY, JSON.stringify({ bookingNumber, contact: contact.trim() }));
  } catch {
    /* ignore */
  }
}

export function getLastBooking(): { bookingNumber: string; contact: string } | null {
  try {
    const raw = sessionStorage.getItem(LAST_BOOKING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
