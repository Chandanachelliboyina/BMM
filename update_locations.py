import re

with open('src/routes/_authenticated/activities.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import
if 'import { MANDAL_VILLAGES_DATA }' not in content:
    content = content.replace('import { useState } from "react";', 'import { useState } from "react";\nimport { MANDAL_VILLAGES_DATA } from "@/data/mandals";')

# 2. Add LocationSelector component
loc_sel = '''
const mandalsList = Object.keys(MANDAL_VILLAGES_DATA).sort();

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
'''
if 'function LocationSelector' not in content:
    content = content.replace('function ActivitiesPage() {', loc_sel + '\nfunction ActivitiesPage() {')

# 3. Add mandal states next to village states
prefixes = ['awareness', 'case', 'followUp', 'counselling', 'referred', 'homeVisit', 'fieldVisit', 'iec', 'dustBin', 'plantSaplings', 'nutritionKits']

for prefix in prefixes:
    cap = prefix[0].upper() + prefix[1:]
    target = f'const [{prefix}Village, set{cap}Village] = useState("");'
    replacement = f'const [{prefix}Mandal, set{cap}Mandal] = useState("");\n  ' + target
    if f'{prefix}Mandal' not in content:
        content = content.replace(target, replacement)

# 4. Update the UI inputs
def replace_input(prefix):
    global content
    cap = prefix[0].upper() + prefix[1:]
    
    # Simple regex to replace the Village input wrapper
    regex = re.compile(
        r'<div className="space-y-2">\s*<Label>Village</Label>\s*<Input\s*placeholder="Enter [^"]*"\s*value=\{'+prefix+r'Village\}\s*onChange=\{\(e\) => set'+cap+r'Village\(e\.target\.value\)\}\s*/>\s*</div>'
    )
    replacement = f'<LocationSelector mandal={{{prefix}Mandal}} setMandal={{set{cap}Mandal}} village={{{prefix}Village}} setVillage={{set{cap}Village}} />'
    content = regex.sub(replacement, content)

for prefix in prefixes:
    replace_input(prefix)

# 5. Update submission string
for prefix in prefixes:
    cap = prefix[0].upper() + prefix[1:]
    old_str = f'- Village: ${{{prefix}Village || "N/A"}}'
    new_str = f'- Mandal: ${{{prefix}Mandal || "N/A"}}\\n- Village: ${{{prefix}Village || "N/A"}}'
    content = content.replace(old_str, new_str)

# 6. Update reset states
for prefix in prefixes:
    cap = prefix[0].upper() + prefix[1:]
    content = content.replace(f'set{cap}Village("");', f'set{cap}Mandal("");\n      set{cap}Village("");')

with open('src/routes/_authenticated/activities.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated activities.tsx successfully.")
