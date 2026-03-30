# Solar Integrated Platform Demo

React + Vite demo สำหรับระบบขาย Solar แบบ end-to-end ตาม PRD ที่ให้มา โดยตั้งใจทำเป็น MVP เชิงใช้งานให้เล่น flow หลักได้จริงผ่าน `localStorage` ก่อน ยังไม่มี database และยังไม่ต่อ API ภายนอก

## สิ่งที่มีใน demo

- `Command Center` สำหรับ dashboard, pipeline, territory pulse และ approval queue
- `Lead CRM` สำหรับค้นหา lead, ดู profile, energy history, owner และ stage
- `Solar Sizing` แบบ rule-based recommendation พร้อม manual override
- `Visit Ops` สำหรับนัดหมายและบันทึกแผนเข้าพบ
- `Quotation Studio` สำหรับ revision, discount threshold, approval flow และ digital signature
- `Package Admin` สำหรับจัดการ package master data
- `Audit trail` และ `running document number`

## วิธีรัน

```bash
npm install
npm run dev
```

สำหรับ production build:

```bash
npm run build
```

## การจำลองข้อมูล

- ข้อมูลทั้งหมดถูกเก็บใน browser `localStorage` key: `solar-demo-state`
- กด `Reset demo` เพื่อคืนค่ากลับเป็น seed data
- กด `Export snapshot` เพื่อโหลด state ปัจจุบันออกมาเป็น JSON
- สลับ role ได้จาก sidebar เพื่อทดสอบสิทธิ์ `Sales / Manager / Admin / Executive`

## Stitch MCP

ผมเชื่อม `stitch` MCP ให้กับ Codex config ของเครื่องนี้แล้วที่ `~/.codex/config.toml`

ถ้าทีมอื่นต้องการตั้งค่าตามใน repo ให้ดูไฟล์ตัวอย่าง:

- [docs/stitch-mcp.example.toml](/Users/sakdithat/Desktop/myproject/solar/docs/stitch-mcp.example.toml)

หมายเหตุ:

- ตัว web app demo นี้ยังไม่ได้เรียก Stitch ตอน runtime
- Stitch ถูกเตรียมไว้เป็น MCP สำหรับ workflow ฝั่ง design / generation / future iteration
- อย่า commit API key จริงลง repo

## โครงสร้างสำคัญ

- [src/App.tsx](/Users/sakdithat/Desktop/myproject/solar/src/App.tsx)
- [src/data/seed.ts](/Users/sakdithat/Desktop/myproject/solar/src/data/seed.ts)
- [src/lib/solar.ts](/Users/sakdithat/Desktop/myproject/solar/src/lib/solar.ts)
- [src/hooks/useLocalStorageState.ts](/Users/sakdithat/Desktop/myproject/solar/src/hooks/useLocalStorageState.ts)
- [src/components/SignaturePad.tsx](/Users/sakdithat/Desktop/myproject/solar/src/components/SignaturePad.tsx)
# solarpeas3
