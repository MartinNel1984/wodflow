// Where "talk to us" goes on wodflow.co.za. Martin's WhatsApp number in
// international format with no plus or spaces, e.g. "27821234567".
export const WHATSAPP_NUMBER = "27825754891";

const message =
  "Hi Martin, I'd like to run my competition on Wodflow.\n\nGym / event name:\nDate:\nAbout how many athletes:";

export const contactHref = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
  : "https://drafttwo.co.za";
