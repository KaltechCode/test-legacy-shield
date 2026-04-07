import { usePageTitle } from "@/hooks/usePageTitle";
import AnimatedSection from "@/components/AnimatedSection";

const PrivacyPolicy = () => {
  usePageTitle("Privacy Policy");

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-primary text-primary-foreground py-16 md:py-20">
        <div className="container mx-auto px-4 lg:px-8">
          <AnimatedSection variant="fade-up">
            <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-4">
              Privacy Policy
            </h1>
            <p className="text-center text-primary-foreground/80 text-lg">
              KB&K Legacy Shield
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <AnimatedSection variant="fade-up">
            <div className="prose prose-lg max-w-none text-foreground">
              <p className="text-muted-foreground mb-8">
                <strong>Effective Date:</strong> December 8, 2025
              </p>

              <p className="mb-8">
                Thank you for visiting KB&K Legacy Shield ("KB&K Legacy Shield," "we," "us," "our"). 
                This Privacy Policy explains how we collect, use, disclose, and protect your information 
                when you visit our website{" "}
                <a href="https://www.kbklegacyshield.com" className="text-accent hover:underline">
                  www.kbklegacyshield.com
                </a>{" "}
                ("Website"). By using this Website, you agree to the practices described below.
              </p>

              {/* Section 1 */}
              <h2 className="font-heading text-2xl font-bold text-primary mt-10 mb-4">
                1. Information We Collect
              </h2>
              <p className="mb-4">
                Because we value transparency, here is exactly what we collect—and what we do not:
              </p>

              <h3 className="font-heading text-xl font-semibold text-primary mt-6 mb-3">
                A. Personal Information You Voluntarily Provide
              </h3>
              <p className="mb-4">
                We collect personal information only when you intentionally submit it through 
                lead-capture forms or contact forms on the Website. This may include:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Name</li>
                <li>Email address</li>
                <li>Phone number</li>
                <li>Any information you choose to share in messages or form fields</li>
              </ul>

              <h3 className="font-heading text-xl font-semibold text-primary mt-6 mb-3">
                B. Information We Do Not Collect
              </h3>
              <p className="mb-4">We do not collect:</p>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Analytics data (we do not use Google Analytics or similar tools)</li>
                <li>Payment information (no checkout or merchant processing occurs on this site)</li>
                <li>Login credentials (our Website does not require user accounts)</li>
              </ul>

              <h3 className="font-heading text-xl font-semibold text-primary mt-6 mb-3">
                C. Automatically Collected Technical Data
              </h3>
              <p className="mb-4">
                Like most websites, our hosting provider may automatically log standard technical 
                information such as IP address, device type, browser type, and timestamp. We do not 
                personally analyze or use this data beyond what is necessary to maintain Website 
                functionality and security.
              </p>

              {/* Section 2 */}
              <h2 className="font-heading text-2xl font-bold text-primary mt-10 mb-4">
                2. How We Use Your Information
              </h2>
              <p className="mb-4">We use the information you provide for purposes such as:</p>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Responding to inquiries</li>
                <li>Delivering requested resources or information</li>
                <li>Providing updates or communication if you opt into them</li>
                <li>Improving user experience and ensuring the Website functions properly</li>
              </ul>
              <p className="mb-4">
                We do not use your data for automated profiling, advertising, or behavioral tracking.
              </p>

              {/* Section 3 */}
              <h2 className="font-heading text-2xl font-bold text-primary mt-10 mb-4">
                3. How We Share Your Information
              </h2>
              <p className="mb-4 font-semibold">
                We do not sell, rent, or trade your personal information—ever.
              </p>
              <p className="mb-4">
                We may share basic data only with trusted service providers who support Website 
                operations or email delivery (for example, a form submission or email service). 
                These providers are permitted to use information solely to perform services on 
                our behalf and must protect it in accordance with applicable privacy laws.
              </p>
              <p className="mb-4">
                We do not share information with advertisers, data brokers, or analytics platforms.
              </p>

              {/* Section 4 */}
              <h2 className="font-heading text-2xl font-bold text-primary mt-10 mb-4">
                4. Cookies and Tracking Technologies
              </h2>
              <p className="mb-4">
                We do not use cookies for analytics, advertising, or tracking. If our hosting 
                platform uses essential cookies for security or basic functionality, those cookies 
                will not collect personal information and are not used for marketing purposes.
              </p>

              {/* Section 5 */}
              <h2 className="font-heading text-2xl font-bold text-primary mt-10 mb-4">
                5. Data Security
              </h2>
              <p className="mb-4">
                We implement reasonable administrative and technical safeguards to protect your 
                information from unauthorized access, alteration, or disclosure. While no website 
                is completely immune from risks, we take your privacy seriously and work to ensure 
                your data remains secure.
              </p>

              {/* Section 6 */}
              <h2 className="font-heading text-2xl font-bold text-primary mt-10 mb-4">
                6. Your Rights
              </h2>
              <p className="mb-4">You may request at any time to:</p>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Access the information we have about you</li>
                <li>Correct inaccurate information</li>
                <li>Request that your information be deleted</li>
                <li>Withdraw consent for future communication</li>
              </ul>
              <p className="mb-4">
                To exercise these rights, email us at{" "}
                <a href="mailto:info.kbklegacyshield.com" className="text-accent hover:underline">
                  info.kbklegacyshield.com
                </a>
                . We will respond within a reasonable timeframe.
              </p>

              {/* Section 7 */}
              <h2 className="font-heading text-2xl font-bold text-primary mt-10 mb-4">
                7. Children's Privacy
              </h2>
              <p className="mb-4">
                Our Website is not intended for individuals under the age of 18. We do not knowingly 
                collect or store information from anyone under 18. If we become aware of such data, 
                we will delete it promptly.
              </p>

              {/* Section 8 */}
              <h2 className="font-heading text-2xl font-bold text-primary mt-10 mb-4">
                8. Changes to This Policy
              </h2>
              <p className="mb-4">
                We may update this Privacy Policy occasionally. The effective date at the top will 
                reflect the most recent version. Continued use of the Website after any update 
                constitutes acceptance of the revised policy.
              </p>

              {/* Section 9 */}
              <h2 className="font-heading text-2xl font-bold text-primary mt-10 mb-4">
                9. Contact Information
              </h2>
              <p className="mb-4">
                For questions, concerns, or privacy requests, contact us at:
              </p>
              <p className="mb-2">
                <strong>Email:</strong>{" "}
                <a href="mailto:info.kbklegacyshield.com" className="text-accent hover:underline">
                  info.kbklegacyshield.com
                </a>
              </p>
              <p className="mb-8">
                <strong>Website:</strong>{" "}
                <a href="https://www.kbklegacyshield.com" className="text-accent hover:underline">
                  www.kbklegacyshield.com
                </a>
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
};

export default PrivacyPolicy;
