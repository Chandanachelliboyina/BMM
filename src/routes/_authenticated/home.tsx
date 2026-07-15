import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

const SLIDES = [
  "/BMM_H.jpg",
  "/BMM_T.jpg",
  "/BMM_NEW.jpg",
  "/BMM_PIC.jpg"
];

function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 4000); // Change image every 4 seconds
    return () => clearInterval(timer);
  }, []);

  return (
    <AppShell title="Home">
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-5xl mx-auto">
        <Card className="overflow-hidden border-none shadow-md">
        <div className="relative w-full h-64 md:h-96">
          {SLIDES.map((src, index) => (
            <img
              key={src}
              src={src}
              alt={`BMM Activity ${index + 1}`}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
                index === currentSlide ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
          <div className="absolute inset-0 bg-black/40 flex items-end">
            <div className="p-6 text-white w-full">
              <h1 className="text-2xl md:text-4xl font-bold mb-2">Bheemabhai Mahila Mandali (BMM)</h1>
              <p className="text-sm md:text-base text-white/90 max-w-3xl">
                A secular, non-profit, and women development voluntary organization.
              </p>
            </div>
          </div>
        </div>
        
        <CardContent className="p-6 md:p-8 space-y-6 text-base leading-relaxed text-muted-foreground text-justify">
          <p>Bheemabhai Mahila Mandali (BMM) is a registered, women-led Non-Governmental organization established in 1995 by Mrs. Vasamsetti Nandivardhana to promote inclusive, equitable, and sustainable development among marginalized communities in Andhra Pradesh. Governed by an 11-members all-women Governing Body comprising experienced professionals and community leaders, BMM is committed to empowering vulnerable populations through participatory, community-driven development.</p>

          <p>BMM is registered under the Societies Registration Act, 1860 and holds all key statutory registrations, including FCRA, 12A, 80G under the Income Tax Act, and CSR Form -1, making it eligible to receive both domestic and international funding.</p>

          <p>For over three decades, BMM has been working with Dalit-Bahujan communities, women, adolescents, youth, children, and People Living with HIV (PLHIV) across Kakinada District and other parts of Andhra Pradesh. The organization envisions an inclusive and just society where marginalized communities live with dignity, enjoy equal opportunities, and actively participate in shaping their own development.</p>

          <p>BMM has built strong partnerships with national and international development agencies. The organization has been supported by Bread for the World (Brot für die Welt), Germany since 2005, WWDP since 2016, and the Azim Premji Foundation since 2025. Following the successful completion of a rigorous pre-funding assessment, BMM has also been selected for the next phase of BMZ-funded programming, reflecting the confidence of international donors in the organization's governance, transparency, and implementation capacity.</p>

          <p>Over the years, BMM has earned the trust of communities through participatory development programmes that emphasize community mobilization, leadership development, awareness generation, capacity building, and improved access to government welfare schemes and social protection programmes. The organization believes that sustainable development is achieved when communities are empowered to identify their own priorities, lead local initiatives, and sustain outcomes through strong community institutions.</p>

          <p>One of BMM's core areas of work has been supporting People Living with HIV (PLHIV) and their families. For nearly 30 years, the organization has provided comprehensive services including nutrition support, counselling, psychosocial care, treatment adherence, stigma reduction, relief and rehabilitation, and linkages to government health and social welfare programmes. These interventions have significantly improved the health, dignity, and quality of life of vulnerable households.</p>

          <p>Women's empowerment remains central to BMM's mission. The organization has strengthened women's leadership, legal awareness, financial literacy, and economic independence through vocational training in tailoring and embroidery, entrepreneurship development, Self-Help Group (SHG) strengthening, market linkages, and livelihood promotion. These initiatives have enhanced household incomes while increasing women's participation in family, community, and local governance processes.</p>

          <p>BMM also invests in adolescents and youth by promoting life skills education, leadership development, digital literacy, career guidance, and employability skills, enabling young people to become responsible citizens, community volunteers, and future leaders.</p>

          <p>Recognizing the increasing vulnerability of coastal Andhra Pradesh to cyclones, floods, and other climate-related disasters, BMM has long been engaged in disaster preparedness and humanitarian response. The organization has implemented community awareness programmes, established early warning systems, trained local volunteers, conducted relief and rehabilitation during cyclones and floods, and organized plantation and seed distribution drives to support environmental restoration and livelihood recovery.</p>

          <p>Building on this extensive experience, BMM is now expanding its work in climate resilience, environmental conservation, and nature-based solutions. Located near the Godavari River, the Kakinada coastline, and the ecologically significant Coringa Mangrove ecosystem, BMM operates in one of India's most environmentally sensitive coastal regions. Rapid tourism growth, plastic pollution, climate change, coastal erosion, and ecosystem degradation pose serious threats to biodiversity and the livelihoods of fishing and coastal communities.</p>

          <p>In response, BMM is implementing community-led initiatives focused on plastic pollution reduction, sustainable waste management, mangrove restoration, coastal ecosystem conservation, biodiversity protection, climate change awareness, disaster risk reduction, and climate-resilient livelihoods. The organization integrates environmental conservation with economic development by promoting green enterprises, eco-friendly entrepreneurship, sustainable tourism practices, and climate-resilient income opportunities, particularly for women and youth.</p>

          <p>Community participation remains the foundation of BMM's development approach. The organization works in close collaboration with village institutions, women's Self-Help Groups, youth groups, Panchayati Raj Institutions, local government departments, civil society organizations, academic institutions, and development partners to ensure that interventions are community-owned, inclusive, and sustainable.</p>

          <p>As BMM approaches more than 30 years of grassroots service, the organization is expanding its geographical outreach across Andhra Pradesh while strengthening partnerships with government agencies, CSR partners, national and international donors, and research institutions. By combining its extensive experience in community development with innovative approaches to climate resilience and environmental conservation, BMM aims to build communities that are socially inclusive, economically resilient, and environmentally sustainable, while contributing to long-term ecological restoration and the achievement of the Sustainable Development Goals (SDGs).</p>
        </CardContent>
      </Card>
    </div>
    </AppShell>
  );
}
