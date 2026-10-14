
import { Heart, Award, Users } from "lucide-react";
import PageLayout from "./PageLayout";

const About = () => {
  const teamMembers = [
    {
      name: "Sarah Johnson",
      role: "Master Baker & Founder",
      description: "With 15 years of baking experience, Sarah brings artistry and passion to every creation.",
    },
    {
      name: "Michael Chen",
      role: "Pastry Chef",
      description: "Trained in Paris, Michael specializes in elegant designs and exquisite flavors.",
    },
    {
      name: "Emily Rodriguez",
      role: "Cake Decorator",
      description: "Emily's creative touch transforms cakes into edible masterpieces.",
    },
  ];

  const coreValues = [
    {
      icon: Heart,
      title: "Made with Love",
      description: "Every cake is crafted with care, passion, and attention to detail.",
    },
    {
      icon: Award,
      title: "Premium Quality",
      description: "We use only the finest natural ingredients for unforgettable taste.",
    },
    {
      icon: Users,
      title: "Community First",
      description: "Your celebrations are our joy. We're here to make your moments special.",
    },
  ];

  return (
    
      <PageLayout>
      <div className="min-h-screen bg-background">
     
      {/* Hero Section */}
      <section className="py-20 px-8 bg-gradient-to-br from-primary/10 to-background">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold">
            About <span className="text-primary font-serif italic">Us</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Where tradition meets creativity in every slice
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20 px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold text-center">
            Our <span className="text-primary font-serif italic">Story</span>
          </h2>
          <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
            <p>
              Founded in 2010, Cakes Bakery began as a small home kitchen operation driven by 
              a simple passion: creating cakes that bring joy to life's most precious moments. 
              What started with a handful of custom orders has blossomed into a beloved community 
              bakery serving hundreds of happy customers.
            </p>
            <p>
              Our journey has been sweetened by the trust and love of our community. Every wedding, 
              birthday, anniversary, and celebration we've been part of has taught us something new 
              and deepened our commitment to excellence. We believe that a cake is more than just 
              dessert—it's a centerpiece of memories, a symbol of celebration, and an expression of love.
            </p>
            <p>
              Today, we continue to honor traditional baking methods while embracing innovation. 
              Our recipes blend time-tested techniques with creative modern flavors, ensuring each 
              cake is both nostalgic and exciting. We're proud to be part of your story, one slice at a time.
            </p>
          </div>
        </div>
      </section>

      {/* Team Members */}
      <section className="py-20 px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto space-y-12">
          <h2 className="text-4xl md:text-5xl font-bold text-center">
            Meet Our <span className="text-primary font-serif italic">Team</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {teamMembers.map((member, index) => (
              <div 
                key={index}
                className="bg-card rounded-2xl p-8 shadow-md hover:shadow-xl transition-shadow space-y-4"
              >
                <div className="w-24 h-24 bg-primary/20 rounded-full mx-auto flex items-center justify-center">
                  <span className="text-4xl">👨‍🍳</span>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-bold">{member.name}</h3>
                  <p className="text-primary font-semibold">{member.role}</p>
                  <p className="text-muted-foreground">{member.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-20 px-8">
        <div className="max-w-6xl mx-auto space-y-12">
          <h2 className="text-4xl md:text-5xl font-bold text-center">
            Our <span className="text-primary font-serif italic">Values</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {coreValues.map((value, index) => {
              const Icon = value.icon;
              return (
                <div 
                  key={index}
                  className="text-center space-y-4 p-8 rounded-2xl hover:bg-muted/30 transition-colors"
                >
                  <div className="w-16 h-16 bg-primary/10 rounded-full mx-auto flex items-center justify-center">
                    <Icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold">{value.title}</h3>
                  <p className="text-muted-foreground text-lg">{value.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 px-8 bg-primary/5">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-4xl md:text-5xl font-bold">
            Ready to Create <span className="text-primary font-serif italic">Something Special?</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Let's make your next celebration unforgettable
          </p>
          <a 
            href="#contact"
            className="inline-block px-8 py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
          >
            Get in Touch
          </a>
        </div>
      </section>
      </div>
       </PageLayout>
    
  );
};

export default About;
