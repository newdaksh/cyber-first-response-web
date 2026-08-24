export const officialReportingUrl = 'https://cybercrime.gov.in/';
export const demoDescription = 'Mujhe bank se call aaya tha KYC ke liye... OTP liya aur 25 hazaar kat gaya.';

export function calculateEvidenceCompleteness(detected: Record<string, string>) {
  const required = ['amount', 'transactionId', 'date', 'time', 'upiId', 'recipient', 'paymentStatus', 'merchantId', 'phoneNumber', 'chatHistory', 'bankAccount'];
  return Math.round((required.filter((field) => Boolean(detected[field])).length / required.length) * 100);
}
