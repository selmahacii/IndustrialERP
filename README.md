# Industrial ERP - Architecture & Workflows

##  System Architecture

```mermaid
graph TD
    User((User)) --> Dashboard[Next.js Dashboard]
    Dashboard --> Auth[Auth Service]
    Dashboard --> Inventory[Inventory Module]
    Dashboard --> Production[Production Module]
    Dashboard --> Finance[Finance Module]
    Dashboard --> HR[HR Module]
    
    subgraph "Core Infrastructure"
        Prisma[Prisma Client]
        SQLite[(SQLite DB)]
        Audit[Audit Logger]
    end
    
    Inventory & Production & Finance & HR --> Prisma
    Prisma --> SQLite
    Prisma -.-> Audit
```

---

##  Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    User ||--o{ AuditLog : "creates"
    User ||--o{ Transaction : "performs"
    User ||--o{ WorkOrder : "creates"
    
    Employee ||--o| User : "is"
    Employee ||--o{ TimeEntry : "has"
    Employee ||--o{ Payroll : "receives"
    Employee ||--o{ WorkOrder : "assigned to"
    
    Category ||--o{ Product : "contains"
    Product ||--o| Inventory : "has"
    Product ||--o{ InventoryMovement : "has"
    Product ||--o{ BOM : "defined by"
    Product ||--o{ WorkOrder : "produced by"
    
    BOM ||--o{ BOMComponent : "contains"
    BOMComponent }|--|| Product : "references"
    
    WorkOrder ||--o{ WorkOrderStep : "has"
    WorkOrder ||--o{ WorkOrderItem : "consumes/produces"
    WorkOrderItem }|--|| Product : "references"
    
    Account ||--o{ Transaction : "mapped to"
    Account ||--o{ JournalLine : "mapped to"
    JournalEntry ||--o{ JournalLine : "contains"
    
    Supplier ||--o{ PurchaseOrder : "provides"
    PurchaseOrder ||--o{ PurchaseOrderLine : "contains"
```

---

##  Core Workflows

### Production Lifecycle

```mermaid
sequenceDiagram
    participant PM as Production Manager
    participant Inv as Inventory
    participant WO as Work Order
    participant Prod as Production Floor

    PM->>WO: Create Work Order (Product, Qty)
    WO->>Inv: Check availability of raw materials (BOM)
    alt Stock Available
        WO->>Inv: Reserve Materials
        PM->>Prod: Start Production
        Prod->>WO: Update Steps (1..N)
        Prod->>WO: Complete Order
        WO->>Inv: Consume Raw Materials (IN OUT)
        WO->>Inv: Add Finished Goods (IN)
        WO->>Inv: Release Reservations
    else Stock Missing
        WO->>PM: Notify Under-stock
    end
```

### Financial Transaction & Audit Flow

```mermaid
sequenceDiagram
    participant U as User
    participant Fin as Finance Module
    participant Audit as Audit System
    participant DB as Database

    U->>Fin: Submit Transaction (Amount, Account, Type)
    Fin->>Fin: Validate Double-Entry
    Fin->>DB: Open Transaction ($transaction)
    DB->>DB: Update Account Balances
    DB->>Audit: Log Transaction Details
    DB->>DB: Commit Transaction
    Fin->>U: Confirm Success
```

---

##  Project Structure

```text
INDUSTRIALERP/
├── src/                # Core Application (Next.js)
│   ├── app/            # API Routes & Pages
│   ├── lib/            # Shared Utilities & Services
│   └── components/     # UI Design System
├── prisma/             # Database Schema & Migrations
├── public/             # Static Assets
└── package.json        # Dependencies & Scripts
```
