import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { MANDAL_VILLAGES_DATA } from "@/data/mandals";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadActivityImage } from "@/lib/storage";
import { Activity, Plus, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
export const Route = createFileRoute("/_authenticated/activities")({
  component: ActivitiesPage,
});


const mandalsList = Object.keys(MANDAL_VILLAGES_DATA).sort();

const STRATEGY_OPTIONS = [
  "Home Visit",
  "Phone Call",
  "Met in Meeting",
  "Field Visit",
  "Directly (face to face)",
  "SHG",
  "Vo's",
  "Women peer Group's",
  "Gender Commitees",
  "Through Phamplets",
  "Village Elders",
  "Through Stakeholder",
  "CF'S",
  "ANM'S",
  "ASHa's"
];


function LocationSelector({ 
  mandal, setMandal, village, setVillage 
}: { 
  mandal: string; setMandal: (v: string) => void; 
  village: string; setVillage: (v: string) => void; 
}) {
  const villages = mandal && MANDAL_VILLAGES_DATA[mandal] ? [...MANDAL_VILLAGES_DATA[mandal]].sort() : [];
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Mandal</Label>
        <Select value={mandal} onValueChange={(val) => { setMandal(val); setVillage(""); }}>
          <SelectTrigger>
            <SelectValue placeholder="Select Mandal" />
          </SelectTrigger>
          <SelectContent>
            {mandalsList.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Village</Label>
        <Input 
          list={`villages-${mandal}`}
          placeholder="Enter or select village..." 
          value={village} 
          onChange={(e) => setVillage(e.target.value)} 
          disabled={!mandal}
        />
        <datalist id={`villages-${mandal}`}>
          {villages.map(v => <option key={v} value={v} />)}
        </datalist>
      </div>
    </div>
  );
}

function ActivitiesPage() {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [meetings, setMeetings] = useState("");
  
  // Activity Points State
  const [awarenessHead, setAwarenessHead] = useState("");
  const [awarenessProgramme, setAwarenessProgramme] = useState("");
  const [awarenessVillage, setAwarenessVillage] = useState("");
  const [awarenessMandal, setAwarenessMandal] = useState("");
  const [awarenessParticipants, setAwarenessParticipants] = useState("");
  const [awarenessCost, setAwarenessCost] = useState("");
  const [awarenessCostType, setAwarenessCostType] = useState<"YES" | "NO" | "">("");
  const [awarenessCostImage, setAwarenessCostImage] = useState<File | null>(null);
  const [activeAwTab, setActiveAwTab] = useState("head");
  
  const [caseIdentified, setCaseIdentified] = useState("");
  const [caseName, setCaseName] = useState("");
  const [caseMandal, setCaseMandal] = useState("");
  const [caseVillage, setCaseVillage] = useState("");
  const [caseCause, setCaseCause] = useState("");
  const [caseStrategy, setCaseStrategy] = useState("");
  
  const [followUp, setFollowUp] = useState("");
  const [followUpName, setFollowUpName] = useState("");
  const [followUpMandal, setFollowUpMandal] = useState("");
  const [followUpVillage, setFollowUpVillage] = useState("");
  const [followUpCause, setFollowUpCause] = useState("");
  const [followUpStrategy, setFollowUpStrategy] = useState("");
  
  const [counselling, setCounselling] = useState("");
  const [counsellingName, setCounsellingName] = useState("");
  const [counsellingMandal, setCounsellingMandal] = useState("");
  const [counsellingVillage, setCounsellingVillage] = useState("");
  const [counsellingCause, setCounsellingCause] = useState("");
  const [counsellingStrategy, setCounsellingStrategy] = useState("");
  
  const [referredType, setReferredType] = useState("");
  const [referredDestinations, setReferredDestinations] = useState<string[]>([]);
  const [referredMandal, setReferredMandal] = useState("");
  const [referredVillage, setReferredVillage] = useState("");
  
  const [homeVisit, setHomeVisit] = useState("");
  const [homeVisitName, setHomeVisitName] = useState("");
  const [homeVisitMandal, setHomeVisitMandal] = useState("");
  const [homeVisitVillage, setHomeVisitVillage] = useState("");
  const [homeVisitStrategy, setHomeVisitStrategy] = useState("");
  const [fieldVisits, setFieldVisits] = useState("");
  const [fieldVisitMandal, setFieldVisitMandal] = useState("");
  const [fieldVisitVillage, setFieldVisitVillage] = useState("");
  const [fieldVisitActivity, setFieldVisitActivity] = useState("");
  const [iecMaterial, setIecMaterial] = useState("");
  const [iecName, setIecName] = useState("");
  const [iecMandal, setIecMandal] = useState("");
  const [iecVillage, setIecVillage] = useState("");
  const [iecQuantity, setIecQuantity] = useState("");
  const [dustBins, setDustBins] = useState("");
  const [dustBinMandal, setDustBinMandal] = useState("");
  const [dustBinVillage, setDustBinVillage] = useState("");
  const [dustBinQuantity, setDustBinQuantity] = useState("");
  const [plantSaplings, setPlantSaplings] = useState("");
  const [plantSaplingsMandal, setPlantSaplingsMandal] = useState("");
  const [plantSaplingsVillage, setPlantSaplingsVillage] = useState("");
  const [plantSaplingsQuantity, setPlantSaplingsQuantity] = useState("");
  const [fieldVisitShowActivity, setFieldVisitShowActivity] = useState(false);
  const [nutritionKits, setNutritionKits] = useState("");
  const [nutritionKitsMandal, setNutritionKitsMandal] = useState("");
  const [nutritionKitsVillage, setNutritionKitsVillage] = useState("");
  const [nutritionKitsQuantity, setNutritionKitsQuantity] = useState("");
  const [staffCapacity, setStaffCapacity] = useState("");
  const [staffReview, setStaffReview] = useState("");
  const [staffReviewPlace, setStaffReviewPlace] = useState("");
  const [officeDoc, setOfficeDoc] = useState("");
  const [officeDocOptions, setOfficeDocOptions] = useState<string[]>([]);
  const [officeDocMinutesQuantity, setOfficeDocMinutesQuantity] = useState("");
  const [officeDocMinutesHeads, setOfficeDocMinutesHeads] = useState("");
  
  const [remarks, setRemarks] = useState("");
  const [activeTab, setActiveTab] = useState<string>("awarenessMeeting");

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const caseDetails = caseIdentified 
        ? `Beneficier (${caseIdentified})\n- Name: ${caseName || "N/A"}\n- Mandal: ${caseMandal || "N/A"}\n- Village: ${caseVillage || "N/A"}\n- Cause: ${caseCause || "N/A"}\n- Strategy: ${caseStrategy || "N/A"}` 
        : "";
        
      const followUpDetails = followUp 
        ? `Follow Up (${followUp})\n- Name: ${followUpName || "N/A"}\n- Mandal: ${followUpMandal || "N/A"}\n- Village: ${followUpVillage || "N/A"}\n- Cause: ${followUpCause || "N/A"}\n- Strategy: ${followUpStrategy || "N/A"}` 
        : "";

      const counsellingDetails = counselling 
        ? `Beneficiary Counselling (${counselling})\n- Name: ${counsellingName || "N/A"}\n- Mandal: ${counsellingMandal || "N/A"}\n- Village: ${counsellingVillage || "N/A"}\n- Cause: ${counsellingCause || "N/A"}\n- Strategy: ${counsellingStrategy || "N/A"}` 
        : "";

      const referredDetails = referredType 
        ? `Referred (${referredType})\n- Destinations: ${referredDestinations.length > 0 ? referredDestinations.join(", ") : "None"}\n- Mandal: ${referredMandal || "N/A"}\n- Village: ${referredVillage || "N/A"}` 
        : "";

      let uploadedImageUrl = "";
      if (awarenessCostType === "YES" && awarenessCostImage) {
        uploadedImageUrl = await uploadActivityImage(user.user.id, awarenessCostImage);
      }

      const costStr = awarenessCostType === "YES" 
        ? `YES ${awarenessCost ? `(Amount: ${awarenessCost})` : ""} ${uploadedImageUrl ? `[Image: ${uploadedImageUrl}]` : ""}` 
        : (awarenessCostType === "NO" ? "NO" : "");

      const awarenessDetails = (awarenessHead || awarenessProgramme || awarenessVillage || awarenessMandal || awarenessParticipants || awarenessCostType) 
        ? `Awareness Meeting Conducted\n- Head of the Meeting: ${awarenessHead || "N/A"}\n- Name of the Programme: ${awarenessProgramme || "N/A"}\n- Target Village: ${awarenessVillage || "N/A"}\n- Target Mandal: ${awarenessMandal || "N/A"}\n- Participant Reached: ${awarenessParticipants || "N/A"}\n- Cost Included: ${costStr || "N/A"}`
        : "";

      const combinedRemarks = [
        awarenessDetails,
        caseDetails,
        followUpDetails,
        counsellingDetails,
        referredDetails,
        homeVisit ? `Home Visit (${homeVisit})\n- Name: ${homeVisitName || "N/A"}\n- Mandal: ${homeVisitMandal || "N/A"}\n- Village: ${homeVisitVillage || "N/A"}\n- Strategy: ${homeVisitStrategy || "N/A"}` : "",
        (fieldVisits || fieldVisitVillage || fieldVisitActivity) ? `Field Visits\n- Mandal: ${fieldVisitMandal || "N/A"}\n- Village: ${fieldVisitVillage || "N/A"}\n- Activity Conducted: ${fieldVisitActivity || "N/A"}` : "",
        (iecMaterial || iecName || iecVillage || iecQuantity) ? `IEC Material Distribution\n- Material Name: ${iecName || "N/A"}\n- Mandal: ${iecMandal || "N/A"}\n- Village: ${iecVillage || "N/A"}\n- Quantity: ${iecQuantity || "N/A"}` : "",
        (dustBins || dustBinVillage || dustBinQuantity) ? `Dust Bins Distribution\n- Mandal: ${dustBinMandal || "N/A"}\n- Village: ${dustBinVillage || "N/A"}\n- Quantity: ${dustBinQuantity || "N/A"}` : "",
        (plantSaplings || plantSaplingsVillage || plantSaplingsQuantity) ? `Plant Saplings Distribution\n- Mandal: ${plantSaplingsMandal || "N/A"}\n- Village: ${plantSaplingsVillage || "N/A"}\n- Quantity: ${plantSaplingsQuantity || "N/A"}` : "",
        (nutritionKits || nutritionKitsVillage || nutritionKitsQuantity) ? `Participated in Nutrition Kits\n- Mandal: ${nutritionKitsMandal || "N/A"}\n- Village: ${nutritionKitsVillage || "N/A"}\n- Quantity: ${nutritionKitsQuantity || "N/A"}` : "",
        staffCapacity ? `Participated in Staff Capacity Building: ${staffCapacity}` : "",
        (staffReview || staffReviewPlace) ? `Participated in Month Staff Review Meeting\n- Place: ${staffReviewPlace || "N/A"}` : "",
        officeDocOptions.length > 0 ? `Attended Office for Documentation\n- Selected: ${officeDocOptions.join(", ")}${officeDocOptions.includes("Minutes") ? `\n  - Minutes Quantity: ${officeDocMinutesQuantity || "N/A"}\n  - Minutes Heads: ${officeDocMinutesHeads || "N/A"}` : ""}` : "",
        remarks ? `General Remarks: ${remarks}` : ""
      ].filter(Boolean).join("\n\n");

      const { error } = await supabase.from("activities").insert({
        user_id: user.user.id,
        date: date,
        villages_visited: 0,
        village_names: "",
        meetings_conducted: meetings,
        remarks: combinedRemarks,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Activity logged successfully!");
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      
      // Reset form
      setMeetings("");
      
      setAwarenessHead("");
      setAwarenessProgramme("");
      setAwarenessMandal("");
      setAwarenessVillage("");
      setAwarenessMandal("");
      setAwarenessParticipants("");
      setAwarenessCost("");
      setAwarenessCostType("");
      setAwarenessCostImage(null);
      setActiveAwTab("head");
      
      setCaseIdentified("");
      setCaseName("");
      setCaseMandal("");
      setCaseVillage("");
      setCaseCause("");
      setCaseStrategy("");
      
      setFollowUp("");
      setFollowUpName("");
      setFollowUpMandal("");
      setFollowUpVillage("");
      setFollowUpCause("");
      setFollowUpStrategy("");
      
      setCounselling("");
      setCounsellingName("");
      setCounsellingMandal("");
      setCounsellingVillage("");
      setCounsellingCause("");
      setCounsellingStrategy("");
      
      setReferredType("");
      setReferredDestinations([]);
      setReferredMandal("");
      setReferredVillage("");
      
      setHomeVisit("");
      setHomeVisitName("");
      setHomeVisitMandal("");
      setHomeVisitVillage("");
      setHomeVisitStrategy("");
      setFieldVisits("");
      setFieldVisitMandal("");
      setFieldVisitVillage("");
      setFieldVisitActivity("");
      setIecMaterial("");
      setIecName("");
      setIecMandal("");
      setIecVillage("");
      setIecQuantity("");
      setDustBins("");
      setDustBinMandal("");
      setDustBinVillage("");
      setDustBinQuantity("");
      setPlantSaplings("");
      setPlantSaplingsMandal("");
      setPlantSaplingsVillage("");
      setPlantSaplingsQuantity("");
      setFieldVisitShowActivity(false);
      setNutritionKits("");
      setNutritionKitsMandal("");
      setNutritionKitsVillage("");
      setNutritionKitsQuantity("");
      setStaffCapacity("");
      setStaffReview("");
      setStaffReviewPlace("");
      setOfficeDoc("");
      setOfficeDocOptions([]);
      setOfficeDocMinutesQuantity("");
      setOfficeDocMinutesHeads("");
      
      setRemarks("");
      setIsSubmitting(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    submitMutation.mutate();
  };

  const tabs = [
    { id: "awarenessMeeting", label: "AWARENESS MEETING CONDUCTED" },
    { id: "caseIdentified", label: "BENEFICIERY IDENTIFIED" },
    { id: "followUp", label: "FOLLOW UP" },
    { id: "counselling", label: "COUNSELLING" },
    { id: "referred", label: "REFERRED" },
    { id: "homeVisit", label: "HOME VISIT" },
    { id: "fieldVisits", label: "FIELD VISITS" },
    { id: "iecMaterial", label: "IEC MATERIAL DISTRIBUTION" },
    { id: "dustBins", label: "DUST BINS DISTRIBUTION" },
    { id: "plantSaplings", label: "PLANT SAPLINGS DISTRIBUTION" },
    { id: "nutritionKits", label: "PARTICIPATED IN NUTRITION KITS" },
    { id: "staffCapacity", label: "PARTICIPATED IN STAFF CAPACITY BUILDING" },
    { id: "staffReview", label: "PARTICIPATED IN MONTH STAFF REVIEW MEETING" },
    { id: "officeDoc", label: "ATTENDED OFFICE FOR DOCUMENTATION" },
  ];

  return (
    <AppShell title="Activities">
      <div className="p-4 md:p-8 pt-6 max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Daily Activities</h2>
            <p className="text-muted-foreground mt-1">
              Log your village visits, meetings conducted, and daily remarks.
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          {/* Form Section */}
          <Card className="w-full h-fit shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                New Activity
              </CardTitle>
              <CardDescription>Record what you did today.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input 
                    type="date" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)} 
                    required 
                    className="md:max-w-[200px]"
                  />
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <Label className="text-primary font-semibold text-lg">Activity Details (Step by Step)</Label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4">
                    {tabs.map((tab) => (
                      <Button 
                        key={tab.id}
                        type="button" 
                        variant={activeTab === tab.id ? "default" : "secondary"}
                        className="w-full min-h-[64px] h-full px-3 py-2 text-xs sm:text-sm font-semibold whitespace-normal text-center shadow-sm"
                        onClick={() => setActiveTab(tab.id)}
                      >
                        {tab.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="bg-muted/30 p-4 rounded-md border min-h-[150px]">
                  
                  {activeTab === "awarenessMeeting" && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="space-y-3">
                        <Label>Select Detail to Fill:</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {[
                            { id: "head", label: "HEAD OF THE MEETING" },
                            { id: "programme", label: "NAME OF THE PROGRAMME" },
                            { id: "target", label: "TARGET" },
                            { id: "participants", label: "PARTICIPANT REACHED" },
                            { id: "cost", label: "IF ANY COST INCLUDE BY YOU" },
                          ].map((tab) => (
                            <Button
                              key={tab.id}
                              type="button"
                              variant={activeAwTab === tab.id ? "default" : "secondary"}
                              onClick={() => setActiveAwTab(tab.id)}
                              className="text-xs w-full h-full whitespace-normal min-h-[48px]"
                            >
                              {tab.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-4 pt-4 border-t border-border mt-4 animate-in slide-in-from-top-2">
                        {activeAwTab === "head" && (
                          <div className="space-y-2">
                            <Label>Head of the Meeting</Label>
                            <Input 
                              placeholder="Enter points/value..." 
                              value={awarenessHead} 
                              onChange={(e) => setAwarenessHead(e.target.value)} 
                            />
                          </div>
                        )}
                        {activeAwTab === "programme" && (
                          <div className="space-y-2">
                            <Label>Name of the Programme</Label>
                            <Input 
                              placeholder="Enter programme name..." 
                              value={awarenessProgramme} 
                              onChange={(e) => setAwarenessProgramme(e.target.value)} 
                            />
                          </div>
                        )}
                        {activeAwTab === "target" && (
                          <div className="space-y-4">
                            <Label>Target Location</Label>
                            <LocationSelector 
                              mandal={awarenessMandal} 
                              setMandal={setAwarenessMandal} 
                              village={awarenessVillage} 
                              setVillage={setAwarenessVillage} 
                            />
                          </div>
                        )}
                        {activeAwTab === "participants" && (
                          <div className="space-y-2">
                            <Label>Participant Reached</Label>
                            <Input 
                              placeholder="Enter number of participants..." 
                              value={awarenessParticipants} 
                              onChange={(e) => setAwarenessParticipants(e.target.value)} 
                            />
                          </div>
                        )}
                        {activeAwTab === "cost" && (
                          <div className="space-y-4">
                            <Label>If Any Cost Include By You</Label>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant={awarenessCostType === "YES" ? "default" : "secondary"}
                                onClick={() => setAwarenessCostType("YES")}
                              >
                                YES
                              </Button>
                              <Button
                                type="button"
                                variant={awarenessCostType === "NO" ? "default" : "secondary"}
                                onClick={() => setAwarenessCostType("NO")}
                              >
                                NO
                              </Button>
                            </div>

                            {awarenessCostType === "YES" && (
                              <div className="space-y-4 mt-4 p-4 border rounded-md bg-background">
                                <div className="space-y-2">
                                  <Label>Payment Amount (Optional)</Label>
                                  <Input 
                                    placeholder="Enter cost details..." 
                                    value={awarenessCost} 
                                    onChange={(e) => setAwarenessCost(e.target.value)} 
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Add Payment Image</Label>
                                  <Input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={(e) => {
                                      if (e.target.files && e.target.files.length > 0) {
                                        setAwarenessCostImage(e.target.files[0]);
                                      }
                                    }} 
                                  />
                                </div>
                              </div>
                            )}

                            {awarenessCostType === "NO" && (
                              <div className="mt-4 p-4 border rounded-md bg-muted/50 text-center font-medium text-muted-foreground">
                                OK - No cost included.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "caseIdentified" && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="space-y-3">
                        <Label>Select Beneficiery Identified Type:</Label>
                        <div className="flex flex-wrap gap-2">
                          {["VAW", "HIV", "Environment", "Education", "Plastic Pollution", "Skill Development"].map((option) => (
                            <Button 
                              key={option}
                              type="button" 
                              variant={caseIdentified === option ? "default" : "secondary"}
                              onClick={() => setCaseIdentified(caseIdentified === option ? "" : option)}
                            >
                              {option}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {caseIdentified && (
                        <div className="space-y-4 pt-4 border-t border-border mt-4 animate-in slide-in-from-top-2">
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input 
                              placeholder="Enter name..." 
                              value={caseName} 
                              onChange={(e) => setCaseName(e.target.value)} 
                            />
                          </div>
                          <LocationSelector mandal={caseMandal} setMandal={setCaseMandal} village={caseVillage} setVillage={setCaseVillage} />
                          <div className="space-y-2">
                            <Label>Cause</Label>
                            <Input 
                              placeholder="Enter cause..." 
                              value={caseCause} 
                              onChange={(e) => setCaseCause(e.target.value)} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Strategy</Label>
                            <Select value={caseStrategy} onValueChange={setCaseStrategy}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select strategy..." />
                              </SelectTrigger>
                              <SelectContent>
                                {STRATEGY_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "followUp" && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="space-y-3">
                        <Label>Select Follow Up Type:</Label>
                        <div className="flex flex-wrap gap-2">
                          {["Women", "Children", "PLHAS", "CLAS"].map((option) => (
                            <Button 
                              key={option}
                              type="button" 
                              variant={followUp === option ? "default" : "secondary"}
                              onClick={() => setFollowUp(followUp === option ? "" : option)}
                            >
                              {option}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {followUp && (
                        <div className="space-y-4 pt-4 border-t border-border mt-4 animate-in slide-in-from-top-2">
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input 
                              placeholder="Enter name..." 
                              value={followUpName} 
                              onChange={(e) => setFollowUpName(e.target.value)} 
                            />
                          </div>
                          <LocationSelector mandal={followUpMandal} setMandal={setFollowUpMandal} village={followUpVillage} setVillage={setFollowUpVillage} />
                          <div className="space-y-2">
                            <Label>Cause</Label>
                            <Input 
                              placeholder="Enter cause..." 
                              value={followUpCause} 
                              onChange={(e) => setFollowUpCause(e.target.value)} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Strategy</Label>
                            <Select value={followUpStrategy} onValueChange={setFollowUpStrategy}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select strategy..." />
                              </SelectTrigger>
                              <SelectContent>
                                {STRATEGY_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "counselling" && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="space-y-3">
                        <Label>Select Counselling Type:</Label>
                        <div className="flex flex-wrap gap-2">
                          {["Women", "Children", "PLHAS", "CLAS"].map((option) => (
                            <Button 
                              key={option}
                              type="button" 
                              variant={counselling === option ? "default" : "secondary"}
                              onClick={() => setCounselling(counselling === option ? "" : option)}
                            >
                              {option}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {counselling && (
                        <div className="space-y-4 pt-4 border-t border-border mt-4 animate-in slide-in-from-top-2">
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input 
                              placeholder="Enter name..." 
                              value={counsellingName} 
                              onChange={(e) => setCounsellingName(e.target.value)} 
                            />
                          </div>
                          <LocationSelector mandal={counsellingMandal} setMandal={setCounsellingMandal} village={counsellingVillage} setVillage={setCounsellingVillage} />
                          <div className="space-y-2">
                            <Label>Cause</Label>
                            <Input 
                              placeholder="Enter cause..." 
                              value={counsellingCause} 
                              onChange={(e) => setCounsellingCause(e.target.value)} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Strategy</Label>
                            <Select value={counsellingStrategy} onValueChange={setCounsellingStrategy}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select strategy..." />
                              </SelectTrigger>
                              <SelectContent>
                                {STRATEGY_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "referred" && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="space-y-3">
                        <Label>Select Referred Type:</Label>
                        <div className="flex flex-wrap gap-2">
                          {["VAW", "HIV", "Environment", "Children", "Education", "Plastic Pollution", "Skill Development"].map((option) => (
                            <Button 
                              key={option}
                              type="button" 
                              variant={referredType === option ? "default" : "secondary"}
                              onClick={() => setReferredType(referredType === option ? "" : option)}
                            >
                              {option}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {referredType && (
                        <div className="space-y-4 pt-4 border-t border-border mt-4 animate-in slide-in-from-top-2">
                          <div className="space-y-3">
                            <Label>Select Referred To (Can select multiple):</Label>
                            <div className="flex flex-wrap gap-2">
                              {[
                                "POLICE", 
                                "LEGAL", 
                                "ART", 
                                "GHC / PHC", 
                                "ICDS", 
                                "WOMEN AND CHILD WELFARE DEPARTMENT", 
                                "WOMEN POLICE STATION",
                                "GRAMPANCHAYATHI",
                                "MUNICIPALITY",
                                "SCHOOL MANGEMENT",
                                "MRO OFFICE",
                                "VRO",
                                "VILLAGE ELDERS",
                                "SACHIVALAYAM"
                              ].map((option) => (
                                <Button 
                                  key={option}
                                  type="button" 
                                  variant={referredDestinations.includes(option) ? "default" : "secondary"}
                                  onClick={() => {
                                    if (referredDestinations.includes(option)) {
                                      setReferredDestinations(referredDestinations.filter(item => item !== option));
                                    } else {
                                      setReferredDestinations([...referredDestinations, option]);
                                    }
                                  }}
                                >
                                  {option}
                                </Button>
                              ))}
                            </div>
                          </div>

                          {referredDestinations.length > 0 && (
                            <div className="space-y-4 pt-4 border-t border-border mt-4 animate-in slide-in-from-top-2">
                              <LocationSelector mandal={referredMandal} setMandal={setReferredMandal} village={referredVillage} setVillage={setReferredVillage} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "homeVisit" && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="space-y-3">
                        <Label>Select Home Visit Type:</Label>
                        <div className="flex flex-wrap gap-2">
                          {["VAW", "HIV", "Environment", "Children", "Education", "Plastic Pollution", "Skill Development"].map((option) => (
                            <Button 
                              key={option}
                              type="button" 
                              variant={homeVisit === option ? "default" : "secondary"}
                              onClick={() => setHomeVisit(homeVisit === option ? "" : option)}
                            >
                              {option}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {homeVisit && (
                        <div className="space-y-4 pt-4 border-t border-border mt-4 animate-in slide-in-from-top-2">
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input 
                              placeholder="Enter name..." 
                              value={homeVisitName} 
                              onChange={(e) => setHomeVisitName(e.target.value)} 
                            />
                          </div>
                          <LocationSelector mandal={homeVisitMandal} setMandal={setHomeVisitMandal} village={homeVisitVillage} setVillage={setHomeVisitVillage} />
                          <div className="space-y-2">
                            <Label>Strategy</Label>
                            <Select value={homeVisitStrategy} onValueChange={setHomeVisitStrategy}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select strategy..." />
                              </SelectTrigger>
                              <SelectContent>
                                {STRATEGY_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {activeTab === "fieldVisits" && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="space-y-2">
                        <Label>Village Name</Label>
                        <Input 
                          placeholder="Enter village name..." 
                          value={fieldVisitVillage} 
                          onChange={(e) => setFieldVisitVillage(e.target.value)} 
                        />
                      </div>
                      {fieldVisitVillage && !fieldVisitShowActivity && (
                        <div className="pt-2 animate-in fade-in">
                          <Button 
                            type="button" 
                            variant="secondary" 
                            onClick={() => setFieldVisitShowActivity(true)}
                          >
                            ACTIVITY CONDUCTED
                          </Button>
                        </div>
                      )}
                      {fieldVisitVillage && fieldVisitShowActivity && (
                        <div className="space-y-2 pt-2 animate-in slide-in-from-top-2">
                          <Label>Activity Conducted</Label>
                          <Textarea 
                            placeholder="Enter activity details..." 
                            value={fieldVisitActivity} 
                            onChange={(e) => setFieldVisitActivity(e.target.value)}
                            rows={3}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  
                  {activeTab === "iecMaterial" && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="space-y-2">
                        <Label>Name of the IEC Material</Label>
                        <Input 
                          placeholder="Enter material name..." 
                          value={iecName} 
                          onChange={(e) => setIecName(e.target.value)} 
                        />
                      </div>
                      <LocationSelector mandal={iecMandal} setMandal={setIecMandal} village={iecVillage} setVillage={setIecVillage} />
                      <div className="space-y-2">
                        <Label>NO. of IEC Distribution</Label>
                        <Input 
                          type="number"
                          placeholder="Enter quantity..." 
                          value={iecQuantity} 
                          onChange={(e) => setIecQuantity(e.target.value)} 
                        />
                      </div>
                    </div>
                  )}
                  
                  {activeTab === "dustBins" && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="space-y-2">
                        <Label>Village Name</Label>
                        <Input 
                          placeholder="Enter village name..." 
                          value={dustBinVillage} 
                          onChange={(e) => setDustBinVillage(e.target.value)} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input 
                          type="number"
                          placeholder="Enter quantity..." 
                          value={dustBinQuantity} 
                          onChange={(e) => setDustBinQuantity(e.target.value)} 
                        />
                      </div>
                    </div>
                  )}
                  
                  {activeTab === "plantSaplings" && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="space-y-2">
                        <Label>Village Name</Label>
                        <Input 
                          placeholder="Enter village name..." 
                          value={plantSaplingsVillage} 
                          onChange={(e) => setPlantSaplingsVillage(e.target.value)} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input 
                          type="number"
                          placeholder="Enter quantity..." 
                          value={plantSaplingsQuantity} 
                          onChange={(e) => setPlantSaplingsQuantity(e.target.value)} 
                        />
                      </div>
                    </div>
                  )}
                  
                  {activeTab === "nutritionKits" && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="space-y-2">
                        <Label>Village Name</Label>
                        <Input 
                          placeholder="Enter village name..." 
                          value={nutritionKitsVillage} 
                          onChange={(e) => setNutritionKitsVillage(e.target.value)} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input 
                          type="number"
                          placeholder="Enter quantity..." 
                          value={nutritionKitsQuantity} 
                          onChange={(e) => setNutritionKitsQuantity(e.target.value)} 
                        />
                      </div>
                    </div>
                  )}
                  
                  {activeTab === "staffCapacity" && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <Label>Participated in Staff Capacity Building</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={staffCapacity === "YES" ? "default" : "secondary"}
                          onClick={() => setStaffCapacity("YES")}
                        >
                          YES
                        </Button>
                        <Button
                          type="button"
                          variant={staffCapacity === "NO" ? "default" : "secondary"}
                          onClick={() => setStaffCapacity("NO")}
                        >
                          NO
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {activeTab === "staffReview" && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="space-y-2">
                        <Label>Place</Label>
                        <Input 
                          placeholder="Enter place..." 
                          value={staffReviewPlace} 
                          onChange={(e) => setStaffReviewPlace(e.target.value)} 
                        />
                      </div>
                    </div>
                  )}
                  
                  {activeTab === "officeDoc" && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <Label>Attended Office for Documentation</Label>
                      <div className="flex flex-col space-y-3 border p-4 rounded-md">
                        {["Work report", "Work plan", "Minutes", "Participants signatures", "Travel"].map((option) => (
                          <div key={option} className="flex items-center space-x-3">
                            <Checkbox
                              id={`office-doc-${option}`}
                              checked={officeDocOptions.includes(option)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setOfficeDocOptions([...officeDocOptions, option]);
                                } else {
                                  setOfficeDocOptions(officeDocOptions.filter(item => item !== option));
                                }
                              }}
                            />
                            <label
                              htmlFor={`office-doc-${option}`}
                              className="text-sm font-medium leading-none cursor-pointer"
                            >
                              {option}
                            </label>
                          </div>
                        ))}
                      </div>

                      {officeDocOptions.includes("Minutes") && (
                        <div className="space-y-4 pt-4 border-t border-border mt-4 animate-in slide-in-from-top-2">
                          <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input 
                              type="number"
                              placeholder="Enter quantity..." 
                              value={officeDocMinutesQuantity} 
                              onChange={(e) => setOfficeDocMinutesQuantity(e.target.value)} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>No. of heads</Label>
                            <Input 
                              placeholder="Enter number of heads..." 
                              value={officeDocMinutesHeads} 
                              onChange={(e) => setOfficeDocMinutesHeads(e.target.value)} 
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-4 border-t mt-6">
                  <Label>Additional Remarks</Label>
                  <Textarea 
                    placeholder="Any other notes for today..." 
                    value={remarks} 
                    onChange={(e) => setRemarks(e.target.value)} 
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full h-12 bg-gradient-primary shadow-elegant mt-2" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Activity className="h-4 w-4 mr-2" />
                  )}
                  Save Activity
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
