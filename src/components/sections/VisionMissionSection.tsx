import { Card, CardContent } from "@/components/ui/card";
import AnimatedSection from "@/components/AnimatedSection";
import visionImage from "@/assets/vision-light-beams.jpg";

const VisionMissionSection = () => {
  return (
    <section className="relative py-20 bg-sky-primary/5">
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-10"
        style={{ backgroundImage: `url(${visionImage})` }}
      ></div>
      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-center mb-16 text-primary">
            Vision & Mission
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Vision */}
            <AnimatedSection variant="fade-up" delay={0}>
              <Card className="shadow-card border-l-4 border-l-sky-primary">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-heading font-bold mb-4 text-sky-primary">
                    Our Vision
                  </h3>
                  <p className="text-lg text-foreground/80 leading-relaxed">
                    To empower one million families to rise from financial fragility to financial 
                    fortification, living with confidence, clarity, and a shield against life's volatility.
                  </p>
                </CardContent>
              </Card>
            </AnimatedSection>

            {/* Mission */}
            <AnimatedSection variant="fade-up" delay={200}>
              <Card className="shadow-card border-l-4 border-l-purple-accent">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-heading font-bold mb-4 text-purple-accent">
                    Our Mission
                  </h3>
                  <p className="text-lg text-foreground/80 leading-relaxed">
                    To financially preserve and elevate our communities one family, one leader, and one 
                    generation at a time. We equip households with the wisdom, tools, and strategies needed 
                    to protect what matters, build lasting wealth, and establish legacies that outlive them.
                  </p>
                </CardContent>
              </Card>
            </AnimatedSection>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VisionMissionSection;
