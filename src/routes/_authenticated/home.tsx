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
        
        <CardContent className="p-6 md:p-8 space-y-6 text-base leading-relaxed text-muted-foreground">
          <p>
            Bheemabhai Mahila Mandali (BMM) is a secular, non-profit, and women development voluntary organization, founded by Mrs. Vasamsetti Nandivardhana in the year 1995 and registered on 7th September 1995 with a determination to strengthen the women and also alleviate poverty in her motherland. It is registered both under the A.P of Societies Act and the Foreign Contribution Regulation Act. BMM is a well-known Voluntary Organization in Kakinada District and it works for women rights and empowerment aimed at gender justice. It has been striving for the Economic development of the women of the down-trodden and weaker sections of the society called "Dalit Bahujan Communities" more than Three decades of Tallarevu, Karapa, Kajuluru and Kakinada Rural Mandals and Ramachandrapuram Mandals.
          </p>

          <p>
            Regarding Health activities, the organization has organized Free Medical Camps, and provide better health services to the women, children and needy people in the community. 'Nutritious food' is supplied to the children of poor families. Legal Aid and family counseling is being provided up by the BMM to protect the women from Atrocities by their family members.
          </p>

          <p>
            Bheemabhai mahila Mandali (BMM) is engaged in the activities of HIV and AIDS, violence against women and girl children, Acts of women and children, health and hygienic seasonal illness like viral fevers, typhoid, jaundice, malaria and chronic diseases. Since its origin Bheemabhi Mahila Mandali (BMM) is working for the poor and Dalit communities to awake against the social evils such as Alcoholism, Prostitution, Dowry System, Corruption etc. Since its inception, the institution was actively engaged in of social service to the helpless and down-trodden. In this regard, Bheemabhai Mahila Mandali addressed into many local issues like restoration of alienated Dalits land, assignment and reassignment of Government assessed waste land, allotment of house site pattas, demands for minimum and equal wages etc.
          </p>

          <p>
            Empowerment of Dalit Bahujan Women is the main objective of this organization which has been stepping to wards achievement by organizing skill development programs to the poor and needy women in tailoring and handicrafts at Tallarevu village with the support of Nehru Yuva Kendra under Ministry of Youth affairs of Indian Government. Formation of Self Help Groups is another strong strategy in promoting confidential levels among dalit bahujan women to lead a better and dignified life in the society.
          </p>

          <p>
            On humanitarian grounds the Welfare of older people has been taken up and to fulfill this objective, day care centre for the older people is being run with the small contributions collected from the local philanthropists. BMM never tolerates social injustice and always struggles for the social equality and justice of the people in distress. BMM's services gained recognition and appreciation from all sects of the target area and given a wider publicity in the newspapers. BMM has also conducted legal literacy camps and provided legal aid for Dalit Bahujan Communities.
          </p>
        </CardContent>
      </Card>
    </div>
    </AppShell>
  );
}
