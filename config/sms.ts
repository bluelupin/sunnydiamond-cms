import type { Core } from '@strapi/strapi';

// Server-only configuration for submission acknowledgements.
const config = ({ env }: Core.Config.Shared.ConfigParams) => ({
  enabled: env.bool('SMS_ENABLED', false),
  provider: 'msg91',
  authKey: env('MSG91_AUTH_KEY', ''),
  senderId: env('MSG91_SENDER_ID', 'SNNYDS'),
  requestTimeoutMs: 10000,
  batchSize: 10,
  maxAttempts: 3,
  retryDelaySeconds: 60,
  templates: {
    // MSG91 Flow/Template ID for the career acknowledgement, not the OTP ID.
    // Its approved DLT template is mapped in the MSG91 dashboard.
    // Fill these IDs here when received from the provider.
    // Carrer Application: DLT template 1477179126539148491, mapped to this MSG91 flow.
    careerApplicationReceived: '6ac4c22cfec5f8794e0b54a4',
    tryAtHomeConfirmed: '',
    // Appointment request: DLT template 1477179126503762776, mapped to this MSG91 flow.
    appointmentRequestReceived: '6ac4c1d39d00097de90045b2',
    // Getting in touch: DLT template 1477179126509255847, mapped to this MSG91 flow.
    enquiryReceived: '6ac4c1f5afe16e84f200f943',
    // Enquiry SMS: DLT template 1477179126544973162, mapped to this MSG91 flow.
    serviceEnquiryReceived: '6ac4c248225b42a41200a934',
  },
  // Reference copy only: MSG91 sends the text stored against each Flow/Template ID.
  // Whitespace is normalized from the supplied copy; verify against the provider sheet.
  // The three {#var#} placeholders are name, date and time, in that order.
  messages: {
    careerApplicationReceived: 'Your career application has received. Our team will contact you soon',
    tryAtHomeConfirmed: 'Dear {#var#}, your Try @ Home appointment is confirmed for {#var#} at {#var#}. We look forward to bringing the Sunny Diamonds experience to you. Sunny Diamonds',
    appointmentRequestReceived: 'Your appointment request is under consideration. Our team will contact you soon',
    enquiryReceived: 'Thank you for inquiring about our service. Our team will contact you soon.',
    serviceEnquiryReceived: 'Thank you for inquiring about our service. Our team will contact you soon. Sunny Diamonds',
  },
});

export default config;
