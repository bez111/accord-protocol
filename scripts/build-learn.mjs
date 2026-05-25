import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const SITE_URL = "https://accordprotocol.ai";
const updated = "2026-05-24";

const articles = [
  {
    slug: "agent-work-agreements",
    title: "What Are Agent Work Agreements?",
    description: "A practical explanation of agent work agreements: terms, authority, verification and settlement records for autonomous software work.",
    eyebrow: "Foundation",
    readTime: "7 min read",
    summary: "Agent work agreements turn a paid request into a machine-readable contract that agents, tools and verifiers can reason about.",
    takeaways: [
      "A payment alone does not say what work was promised.",
      "Accord records terms, verification and settlement as separate protocol objects.",
      "The model is useful for APIs, MCP tools, agent-to-agent workflows and human-assisted tasks."
    ],
    sections: [
      {
        heading: "The problem is not payment. It is context.",
        body: [
          "Autonomous agents can already call APIs, invoke MCP tools and trigger paid HTTP flows. The missing piece is the shared record around the work itself. A payment receipt can prove that value moved, but it rarely proves what the seller promised, what output was expected, who was allowed to verify it or what happened after the work was reviewed.",
          "An agent work agreement fills that gap. It gives both sides a structured object that can be hashed, referenced by payment authority, checked by policy engines and used later as evidence for settlement or reputation."
        ]
      },
      {
        heading: "What an agreement needs to answer",
        body: [
          "A useful agreement answers the same questions a careful operator would ask before approving spend: who is buying, who is executing, what task is requested, what asset and amount are involved, what deadline applies, what output format is acceptable and who decides whether the work is complete.",
          "Accord treats those answers as protocol data, not prose hidden in a chat transcript. That matters because agents need deterministic inputs for policy, verification and audit."
        ]
      },
      {
        heading: "Why receipts are separate",
        body: [
          "Accord separates the Agreement Object from the Verification Receipt and Settlement Receipt. That separation is deliberate. The agreement describes intent. The verification receipt records a verdict on the output. The settlement receipt records the economic closeout.",
          "Keeping these records separate makes the lifecycle easier to inspect. A failed task can still have a valid agreement and a valid rejection receipt. A completed task can be verified before final settlement. A rail can settle later without changing the original promise."
        ]
      }
    ],
    faq: [
      ["Is an agent work agreement a legal contract?", "Accord defines protocol objects for machine-readable work terms. Legal interpretation depends on jurisdiction, parties and surrounding terms."],
      ["Does Accord require a blockchain?", "No. Accord is rail-agnostic. Blockchains are one way to settle or anchor receipts, but the agreement model is broader."]
    ]
  },
  {
    slug: "accord-vs-x402",
    title: "Accord Protocol vs x402",
    description: "How Accord and x402 fit together: x402 verifies paid HTTP access, while Accord verifies completion of the work around that payment.",
    eyebrow: "Comparison",
    readTime: "6 min read",
    summary: "x402 is strong for paid HTTP resources. Accord adds the work-agreement layer around payment, verification and settlement receipts.",
    takeaways: [
      "x402 and Accord are complementary, not competitors.",
      "x402 can express payment challenges and payment proofs.",
      "Accord records what work was promised and whether it was completed."
    ],
    sections: [
      {
        heading: "The shortest distinction",
        body: [
          "x402 verifies payment. Accord verifies completion.",
          "That sentence is the cleanest way to separate the two. x402 gives HTTP services a standard way to request payment for a resource. Accord gives agents a standard way to record the work terms and the result of that work."
        ]
      },
      {
        heading: "Where x402 stops",
        body: [
          "A paid HTTP response can prove that a buyer satisfied a payment challenge, but it does not by itself define the acceptance criteria for a complex task. If the task is a repository audit, model evaluation, data transformation or multi-step research job, the buyer still needs a record of what was promised and how the output was judged.",
          "This is where Accord sits. It can reference payment authority or payment proof while keeping the agreement and receipts explicit."
        ]
      },
      {
        heading: "How they work together",
        body: [
          "In an Accord/402 flow, the HTTP payment step is one part of a broader lifecycle. The Agreement Object defines the task. The payment proof or authority references that agreement. The executor performs the work. A verifier signs a Verification Receipt. A Settlement Receipt records the closeout on the chosen rail.",
          "This composition lets developers keep x402 for what it does well while adding machine-readable completion semantics."
        ]
      }
    ],
    faq: [
      ["Does Accord replace x402?", "No. Accord can use x402-compatible payment flows as one rail or transport component."],
      ["Can x402 prove work quality?", "Not by itself. Work quality depends on agreement terms, verifier design and receipt policy."]
    ]
  },
  {
    slug: "verification-receipts",
    title: "Verification Receipts for AI Agents",
    description: "Why verification receipts matter for autonomous agent workflows and how they record accepted, rejected or partially accepted work.",
    eyebrow: "Protocol object",
    readTime: "7 min read",
    summary: "A Verification Receipt records a verifier's verdict on work output so agents can distinguish payment from completion.",
    takeaways: [
      "Verification is the bridge between task output and settlement.",
      "Receipts should be signed, scoped to an agreement and explicit about the verdict.",
      "A rejection receipt is still useful protocol data."
    ],
    sections: [
      {
        heading: "Why verification needs its own object",
        body: [
          "Agent workflows need more than a binary payment event. A buyer may pay for access, escrow funds or issue credit before the work is complete. The system still needs a later record that says whether the delivered output matched the agreement.",
          "The Verification Receipt is that record. It gives the verifier a structured way to say accepted, rejected or partially accepted, and to bind that verdict to the original agreement."
        ]
      },
      {
        heading: "What a good receipt includes",
        body: [
          "A useful verification receipt should identify the agreement, the verifier, the verdict, relevant output references, timestamps and signature material. It should be deterministic enough for conformance testing and explicit enough for policy engines to evaluate.",
          "The receipt does not magically make the verifier honest. It makes the verifier's claim inspectable."
        ]
      },
      {
        heading: "Verifier design is a product decision",
        body: [
          "A verifier can be a deterministic test suite, a human reviewer, a model-based evaluator, a committee or an application-specific oracle. Accord does not prescribe one universal verifier. It gives each implementation a common receipt shape so downstream tools can reason about the verdict.",
          "For production systems, verifier assumptions are part of the trust boundary and should be documented as carefully as payment or signing assumptions."
        ]
      }
    ],
    faq: [
      ["Does a Verification Receipt prove the work is objectively correct?", "No. It records a verifier's signed verdict under the agreement's verification rules."],
      ["Can work be partially accepted?", "Yes. Accord's model allows a verifier to record accepted, rejected or partially accepted outcomes."]
    ]
  },
  {
    slug: "settlement-receipts",
    title: "Settlement Receipts and Agent Payment Records",
    description: "How Settlement Receipts record the economic closeout of agent work across rails without making Accord a payment processor.",
    eyebrow: "Protocol object",
    readTime: "6 min read",
    summary: "Settlement Receipts make the economic closeout inspectable without turning Accord into a bank, wallet or custodian.",
    takeaways: [
      "Settlement is rail-specific, but the receipt shape can be shared.",
      "A Settlement Receipt records proof or transaction references.",
      "Accord is not a payment processor or custodian."
    ],
    sections: [
      {
        heading: "Why settlement needs a receipt",
        body: [
          "In agent workflows, settlement can happen through different rails: a mock rail in local demos, an HTTP payment proof, an Ergo testnet transaction, a bridged asset path or an EVM reference rail. Each rail has its own assumptions and proof format.",
          "A Settlement Receipt gives the broader Accord lifecycle a common record that settlement happened, where it happened and what evidence supports that claim."
        ]
      },
      {
        heading: "Rail-specific proof, shared lifecycle",
        body: [
          "Accord does not flatten every rail into the same trust model. Instead, it records the rail, the settlement status and the relevant proof or transaction reference. That lets integrations keep their rail-specific security assumptions while preserving a shared work-agreement lifecycle.",
          "This is important for agents because settlement policy can differ by asset, chain, facilitator, bridge, verifier or spending threshold."
        ]
      },
      {
        heading: "What Accord is not",
        body: [
          "Accord is not a bank, broker, custodian, wallet or money transmitter. It does not move funds by itself. It records why and whether value should move, and it links settlement evidence back to the work agreement and verification result.",
          "That boundary should stay clear in product copy, documentation and agent-facing summaries."
        ]
      }
    ],
    faq: [
      ["Does Accord custody funds?", "No. Accord defines protocol objects and reference adapters; settlement happens on external rails."],
      ["Can the same agreement settle on different rails?", "The model is rail-agnostic, but each implementation must document its rail assumptions and policy."]
    ]
  },
  {
    slug: "accord-mcp-paid-tools",
    title: "Accord/MCP for Paid and Verifiable Tools",
    description: "How Accord/MCP adds payment and completion semantics around MCP tools used by autonomous agents.",
    eyebrow: "Transport",
    readTime: "7 min read",
    summary: "Accord/MCP wraps tool calls with agreement, payment and verification semantics that MCP alone does not model.",
    takeaways: [
      "MCP explains how agents call tools.",
      "Accord/MCP adds terms, payment policy and verification receipts.",
      "The safest first demo is the mock rail paid MCP repository audit."
    ],
    sections: [
      {
        heading: "MCP connects tools. Accord adds work semantics.",
        body: [
          "The Model Context Protocol gives agents a way to discover and call tools. That solves a major interoperability problem, but it does not define how a tool should price work, verify completion or record settlement.",
          "Accord/MCP sits around the tool call. It can bind a request to an Agreement Object, require payment or payment authority, run the handler, invoke verification and emit receipts."
        ]
      },
      {
        heading: "Why paid tools need more than access control",
        body: [
          "A paywalled tool can charge for access, but many agent tasks are outcome-oriented. A buyer may care less about whether a request was served and more about whether the promised analysis, audit, transformation or report met the agreed acceptance criteria.",
          "Accord/MCP gives tool builders a protocol vocabulary for that distinction."
        ]
      },
      {
        heading: "Start with the mock rail",
        body: [
          "The recommended first run is the paid MCP repository audit example. It exercises the lifecycle without real funds, chain state or facilitator trust. That makes it appropriate for developers who want to understand Accord before touching testnet rails.",
          "Only after the lifecycle is clear should teams move toward rail-specific testnet experiments."
        ]
      }
    ],
    faq: [
      ["Does Accord/MCP require real payments?", "No. The mock rail demo runs the lifecycle without real funds."],
      ["Can any MCP tool use Accord?", "In principle yes, but useful integration depends on pricing, verification and policy design."]
    ]
  },
  {
    slug: "rail-adapters",
    title: "Rail Adapters in Accord Protocol",
    description: "A guide to Accord rail adapters and how they separate agreement semantics from settlement mechanisms.",
    eyebrow: "Architecture",
    readTime: "6 min read",
    summary: "Rail adapters let Accord keep a shared agreement lifecycle while respecting different settlement systems and trust assumptions.",
    takeaways: [
      "Accord is rail-agnostic.",
      "Rail adapters expose payment verification and settlement behavior.",
      "Each rail keeps its own security assumptions."
    ],
    sections: [
      {
        heading: "The agreement layer should not be rail-locked",
        body: [
          "Agent work agreements should outlive any single payment rail. A task agreement, verification verdict and settlement record are useful whether the economic closeout uses a mock rail, an HTTP payment proof, Ergo testnet, Rosen-bridged assets or an EVM reference path.",
          "Accord uses rail adapters to keep those concerns separate."
        ]
      },
      {
        heading: "What an adapter does",
        body: [
          "A rail adapter is responsible for rail-specific operations such as payment verification, lock or issue behavior, settlement submission and proof collection. The adapter does not redefine the Agreement Object. It connects the shared lifecycle to the chosen economic system.",
          "This makes conformance easier: implementations can be tested for protocol compatibility while still documenting rail-specific limits."
        ]
      },
      {
        heading: "Why status language matters",
        body: [
          "The current reference rails are testnet-first and audit-gated. Passing conformance does not mean a rail is production-certified. A rail can be compatible with Accord while still being unsuitable for mainnet funds.",
          "That distinction needs to be preserved in developer docs, marketing pages and AI-generated summaries.",
          "The rail maturity matrix is the current source for comparing mock, Sage Ergo, Base Sepolia, x402 and Rosen by purpose, evidence, receipt surface, conformance, risk boundary and mainnet gate."
        ]
      }
    ],
    faq: [
      ["Is Ergo the only Accord rail?", "No. Ergo is the first reference programmable-settlement rail, but Accord is rail-agnostic."],
      ["Does conformance certify mainnet safety?", "No. Conformance means compatibility with Accord rules, not external audit completion."]
    ],
    references: [
      {
        label: "Rail maturity matrix",
        url: "https://github.com/accord-protocol/accord-protocol/blob/main/docs/RAIL_MATURITY_MATRIX.md",
        note: "Operating matrix for current rail maturity, evidence, receipts, conformance and mainnet gates."
      }
    ]
  },
  {
    slug: "provider-onboarding",
    title: "How to Become an Accord-Compatible Provider",
    description: "A practical onboarding path for APIs, MCP tools and agent services that want to emit Accord agreements, verification receipts and settlement receipts.",
    eyebrow: "Provider guide",
    readTime: "8 min read",
    summary: "Providers become Accord-compatible by exposing work terms, verification and settlement evidence as schema-valid protocol objects.",
    takeaways: [
      "Accord-compatible means receipt-compatible, not mainnet-certified.",
      "A provider needs a narrow work surface, verifier design, receipt emission and conformance evidence.",
      "Sage is the current public example of a live testnet provider surface."
    ],
    sections: [
      {
        heading: "Start with one paid work surface",
        body: [
          "A good first Accord provider integration is narrow. Pick one paid API response, MCP tool, model evaluation, code review, repository audit or research answer. Define what the buyer asks for, what output the provider returns, which verifier decides acceptance and which rail records payment or settlement.",
          "Trying to make a whole platform Accord-compatible at once makes verification vague. One crisp work surface gives agents and auditors something concrete to inspect.",
          "The repository now includes a copyable provider onboarding kit with .well-known/accord files, sample receipt JSON, a registry profile, badge language and a registry PR template."
        ]
      },
      {
        heading: "Emit the three protocol objects",
        body: [
          "The provider should emit an Agreement for the task terms, a Verification Receipt for the acceptance verdict and a Settlement Receipt for the economic closeout. Each object should validate against the public v0 schemas and bind to the others through hashes and identifiers.",
          "This is the difference between a payment demo and an Accord provider. The payment proof is useful, but the provider claim becomes inspectable when the receipt bundle is public and schema-valid."
        ]
      },
      {
        heading: "Run conformance and publish evidence",
        body: [
          "Before publishing compatibility claims, run the reference conformance suite and publish sample receipts, hashes, endpoint URLs and rail-specific evidence. Hosted providers should also expose an Accord challenge/payment endpoint when using network conformance.",
          "The current Sage surface is a useful reference: its public receipt bundle includes schema-valid Agreement, Verification Receipt and Settlement Receipt JSON, matching hashes, Ed25519 signatures, Ergo testnet settlement evidence and L1 conformance."
        ]
      }
    ],
    faq: [
      ["Does a provider need mainnet support?", "No. Testnet, mock and local providers can be Accord-compatible if they emit valid protocol objects and describe their rail posture clearly."],
      ["What should a registry entry include?", "Provider identity, supported rails, conformance level, evidence URI, verifier assumptions, audit status and mainnet status."]
    ],
    references: [
      {
        label: "Provider onboarding guide",
        url: "https://github.com/accord-protocol/accord-protocol/blob/main/docs/PROVIDER_ONBOARDING.md",
        note: "Canonical repository guide for third-party provider integration."
      },
      {
        label: "Provider onboarding kit",
        url: "https://github.com/accord-protocol/accord-protocol/tree/main/examples/17-provider-onboarding-kit",
        note: "Copyable .well-known/accord, receipt, registry profile, badge and PR templates."
      },
      {
        label: "Sage full receipt result",
        url: "https://github.com/accord-protocol/accord-protocol/blob/main/docs/pilots/results/2026-05-24-sage-ergo-testnet-full-receipt-recheck.md",
        note: "Live public provider receipt bundle and Ergo testnet settlement evidence."
      }
    ]
  },
  {
    slug: "launch-readiness-gates",
    title: "Accord Launch Readiness Gates",
    description: "Why Accord is holding broad public launch until the evidence, provider onboarding and audit posture are polished.",
    eyebrow: "Pre-launch",
    readTime: "6 min read",
    summary: "Accord launch posts are intentionally deferred until the public surface points to evidence instead of asking for trust.",
    takeaways: [
      "Launch distribution is a final lever, not the next engineering task.",
      "The current priority is polish: source-of-truth consistency, provider onboarding, proof narratives and audit posture.",
      "Mainnet launch remains separate from public awareness launch."
    ],
    sections: [
      {
        heading: "Do not launch to discover the story",
        body: [
          "Accord now has enough testnet evidence to be credible, but broad distribution should wait until the public surface is easy to verify from the outside. A launch should not ask readers to believe the protocol. It should route them to receipts, conformance, pilot records, provider onboarding and clear mainnet limits.",
          "That is why manual indexing, HN, Reddit, X, Discord and mcp.so are deferred until the launch readiness gates pass."
        ]
      },
      {
        heading: "What must be polished first",
        body: [
          "The launch package needs one golden path, consistent status language, Sage and Base proof narratives, provider onboarding, audit-scope clarity and mobile-friendly site pages. Those surfaces matter because most launch readers will not inspect the whole repository.",
          "If status, roadmap, README, pilots and registry entries agree, agents and humans can reason about the project without private context."
        ]
      },
      {
        heading: "Public launch is not mainnet launch",
        body: [
          "A public launch may announce the open standard, SDKs, schemas, conformance and testnet proofs. It must not imply that real-fund production rails are certified.",
          "Mainnet promotion remains a separate P5 event requiring signed external audit manifests with exact artifacts marked mainnetAllowed: true."
        ]
      }
    ],
    faq: [
      ["Why not post now?", "Because the best launch is evidence-led. The remaining work is polish, onboarding and audit clarity, not attention."],
      ["Does launch readiness change mainnet status?", "No. Mainnet remains NOT CERTIFIED FOR MAINNET until signed audit manifests allow exact artifacts."]
    ],
    references: [
      {
        label: "Launch readiness document",
        url: "https://github.com/accord-protocol/accord-protocol/blob/main/docs/LAUNCH_READINESS.md",
        note: "Canonical launch gate checklist."
      }
    ]
  },
  {
    slug: "why-ergo-reference-rail",
    title: "Why Ergo Is the First Accord Reference Rail",
    description: "Why Accord uses Ergo as its first reference programmable settlement rail, and what claims should be avoided until audits are complete.",
    eyebrow: "Reference rail",
    readTime: "7 min read",
    summary: "Ergo is a strong first reference rail because of its eUTXO model, ErgoScript and programmable settlement primitives, but current use remains testnet-first.",
    takeaways: [
      "Ergo is the first reference rail, not the only possible rail.",
      "The useful primitives include Notes, Reserves, Trackers and acceptance predicates.",
      "The current posture is testnet-only and audit-gated."
    ],
    sections: [
      {
        heading: "Why Ergo fits the reference design",
        body: [
          "Accord's first reference settlement rail needs programmable conditions, deterministic state references and a clear path for binding task results to economic behavior. Ergo's eUTXO model and ErgoScript make it a natural environment for exploring those patterns.",
          "The design space includes Reserve, Note, Tracker and Acceptance Predicate concepts that map well to agent work settlement experiments."
        ]
      },
      {
        heading: "What this does not imply",
        body: [
          "Using Ergo as the first reference rail does not mean Accord is Ergo-only. It also does not mean every Ergo-based script is audited, production-safe or appropriate for real funds.",
          "The correct language is precise: Ergo is the first reference programmable settlement rail; current mainnet use is not certified until signed audit manifests say otherwise."
        ]
      },
      {
        heading: "Why testnet-first is the right posture",
        body: [
          "Agent settlement combines payment policy, verifier assumptions, script correctness, wallet behavior, bridge or facilitator risk and operational controls. That is too much surface area to compress into a casual production-ready claim.",
          "A testnet-first posture lets developers validate lifecycle semantics before exposing real value."
        ]
      }
    ],
    faq: [
      ["Is Ergo required to use Accord?", "No. Accord is rail-agnostic."],
      ["Are Ergo rail scripts mainnet-certified today?", "No. Current status is testnet-first and audit-gated."]
    ]
  },
  {
    slug: "conformance-levels",
    title: "Accord Conformance Levels L0-L4",
    description: "What Accord conformance levels mean, what they test and why conformance is not the same as production certification.",
    eyebrow: "Conformance",
    readTime: "6 min read",
    summary: "Conformance checks compatibility with Accord v0 rules. It does not replace external audits or production risk review.",
    takeaways: [
      "L0-L4 cover schema, transport, rail, security and registry shape.",
      "Conformance helps implementations interoperate.",
      "Conformance is not a mainnet safety certificate."
    ],
    sections: [
      {
        heading: "Why conformance exists",
        body: [
          "Open protocols need independent implementations. Independent implementations need shared tests. Accord's conformance levels give builders a way to check whether their objects, transports, rail adapters and registry metadata match the current v0 expectations.",
          "This helps avoid silent drift between SDKs, gateways, MCP wrappers and rail packages."
        ]
      },
      {
        heading: "What the levels mean",
        body: [
          "L0 means schema-compatible. L1 means transport-compatible. L2 means rail-compatible against reference rails. L3 means security-compatible guardrail checks are present. L4 means registry-certified shape and cross-reference checks.",
          "These levels are about protocol compatibility. They are not a statement that a verifier is honest, a bridge is safe or a script has passed external audit."
        ]
      },
      {
        heading: "How teams should use conformance",
        body: [
          "Teams should run conformance during development, CI and release review. They should treat failures as compatibility issues, and they should document any intentional deviations clearly.",
          "For real value, conformance should be one input into a broader safety process that includes audits, policy caps, signer controls, testnet history and operational monitoring."
        ]
      }
    ],
    faq: [
      ["Does L4 mean production-ready?", "No. L4 means registry-certified shape and cross-reference checks, not production certification."],
      ["Should every implementation run conformance?", "Yes, if it claims Accord compatibility."]
    ]
  },
  {
    slug: "audit-gated-mainnet",
    title: "Audit-Gated Mainnet Policy for Accord",
    description: "Why Accord keeps mainnet use blocked by default until signed audit manifests explicitly allow relevant scripts or contracts.",
    eyebrow: "Safety",
    readTime: "6 min read",
    summary: "Accord's safety posture is intentionally conservative: local demos and testnets first, mainnet only after signed audit manifests.",
    takeaways: [
      "Current Accord v0 is NOT CERTIFIED FOR MAINNET.",
      "Mainnet writes are blocked until signed audit manifests allow them.",
      "Dangerous overrides are not production guidance."
    ],
    sections: [
      {
        heading: "The policy in one sentence",
        body: [
          "Accord v0 is alpha, testnet-first software and NOT CERTIFIED FOR MAINNET.",
          "That sentence should appear consistently in docs, site copy and AI-facing summaries because ambiguity around money movement is dangerous."
        ]
      },
      {
        heading: "Why signed manifests matter",
        body: [
          "A rail implementation can include scripts, contract bytecode, compiled trees and operational assumptions. A signed audit manifest gives the SDK and operators a concrete identity to check before allowing production behavior.",
          "Without that evidence, the safe default is denial."
        ]
      },
      {
        heading: "What builders can do today",
        body: [
          "Builders can run local demos, mock rail flows, conformance tests, MCP tool gating prototypes and testnet experiments. Those activities are valuable because they validate the protocol lifecycle without pretending the mainnet risk review is complete.",
          "Teams preparing for production should focus on audit evidence, verifier assumptions, spending policy, signer operations and incident response before any real-fund deployment."
        ]
      }
    ],
    faq: [
      ["Can I use Accord with real funds today?", "The current public status says no by default. Real-fund production use is blocked until signed audit manifests allow it."],
      ["Are dangerous overrides acceptable for production?", "No. Overrides are for research and controlled testing, not production guidance."]
    ]
  }
];

articles.push(
  {
    slug: "accord-vs-ap2",
    title: "Accord Protocol vs AP2",
    description: "How Accord relates to AP2-style authorization: AP2 helps express authority, while Accord records work terms, verification and settlement.",
    eyebrow: "Comparison",
    readTime: "6 min read",
    summary: "AP2-style mandates and Accord agreements solve different layers of the agent payment problem.",
    takeaways: [
      "AP2-style flows are useful for authorization and accountability.",
      "Accord records what work was promised and whether it was completed.",
      "The layers can be composed in one agent workflow."
    ],
    sections: [
      {
        heading: "Authorization is not completion",
        body: [
          "Agent payment systems need a way to show that an agent had authority to spend or act. AP2-style mandate flows are useful for expressing that authority. But authorization does not answer whether the requested work was actually completed.",
          "Accord sits after and around authorization. It gives the parties a work agreement, a verification receipt and a settlement receipt that can reference the relevant payment authority."
        ]
      },
      {
        heading: "Where Accord fits",
        body: [
          "An Accord Agreement can include the task, acceptance criteria, verifier and rail assumptions. A payment mandate or authority mechanism can reference that agreement. After execution, the Verification Receipt records the result and the Settlement Receipt records the economic closeout.",
          "This makes authorization part of the record rather than the whole record."
        ]
      },
      {
        heading: "Why this matters for buyers",
        body: [
          "Buyers need policies that distinguish allowed spend from accepted work. A buyer policy engine might approve a payment authority for a bounded task, but it still needs the verifier's later receipt to decide whether funds should settle, reputation should update or a dispute path should open.",
          "Accord gives those decisions protocol objects instead of relying on informal logs."
        ]
      }
    ],
    faq: [
      ["Does Accord replace AP2?", "No. Accord can sit alongside AP2-style authorization and add the work lifecycle around it."],
      ["Can an Accord Agreement reference payment authority?", "Yes. The agreement lifecycle can include payment authority or payment proof as part of the flow."]
    ]
  },
  {
    slug: "accord-vs-mcp",
    title: "Accord Protocol vs MCP",
    description: "MCP connects agents to tools. Accord adds paid-work terms, verification receipts and settlement records around tool calls.",
    eyebrow: "Comparison",
    readTime: "6 min read",
    summary: "MCP and Accord are complementary: one connects tools, the other records paid work agreements.",
    takeaways: [
      "MCP is a tool connectivity layer.",
      "Accord is a work-agreement lifecycle layer.",
      "Accord/MCP can make paid tools verifiable."
    ],
    sections: [
      {
        heading: "MCP solves the tool interface",
        body: [
          "MCP gives agents a standard way to discover and call tools. That is a foundational capability for agent systems, but it does not define pricing, acceptance criteria, payment settlement or dispute records for paid work.",
          "Accord adds those missing semantics without replacing MCP."
        ]
      },
      {
        heading: "Accord adds the commercial record",
        body: [
          "When a tool call has economic consequences, the buyer needs a record of the requested work, the payment authority, the verifier and the settlement result. Accord's objects make that record explicit.",
          "This is especially important when tools perform non-trivial work such as code review, research, data transformation or compliance checks."
        ]
      },
      {
        heading: "The combined shape",
        body: [
          "In an Accord/MCP integration, MCP still handles the tool call. Accord wraps that call in agreement, verification and settlement data. The tool can stay focused on execution while the surrounding protocol records the lifecycle.",
          "That separation makes implementations easier to inspect and safer to evolve."
        ]
      }
    ],
    faq: [
      ["Does every MCP tool need Accord?", "No. Accord is most useful when tool calls involve payment, acceptance criteria or settlement records."],
      ["Does Accord change the MCP protocol itself?", "No. Accord/MCP is an integration layer around paid and verifiable tool calls."]
    ]
  },
  {
    slug: "accord-402-flow",
    title: "How Accord/402 Works",
    description: "A step-by-step guide to Accord/402, the HTTP paid-resource flow that combines payment proof with agreement and verification receipts.",
    eyebrow: "Transport",
    readTime: "7 min read",
    summary: "Accord/402 adds agreement and receipt semantics to paid HTTP flows.",
    takeaways: [
      "HTTP payment proof is one step in a broader lifecycle.",
      "The Agreement Object scopes the paid work.",
      "Verification and settlement receipts complete the record."
    ],
    sections: [
      {
        heading: "The basic flow",
        body: [
          "A service can challenge a client for payment before serving a resource. Accord/402 keeps that payment step, but adds a work agreement around it. The client and service can bind the request to a canonical Agreement Object before execution.",
          "After the work is performed, a verifier emits a Verification Receipt and the rail or facilitator evidence is recorded in a Settlement Receipt."
        ]
      },
      {
        heading: "Why this is different from access",
        body: [
          "Access control answers whether a request can proceed. Work verification answers whether the output satisfied the agreement. Those are different questions, and conflating them creates weak audit trails.",
          "Accord/402 lets HTTP services keep simple paid-resource mechanics while making completion explicit."
        ]
      },
      {
        heading: "Safe implementation posture",
        body: [
          "Developers should start with mock or testnet flows, log agreement hashes, verify replay protection and document facilitator assumptions. Real-value production flows require signed audit manifests and operational controls.",
          "The current public Accord posture remains testnet-first and not certified for mainnet."
        ]
      }
    ],
    faq: [
      ["Is Accord/402 the same as x402?", "No. Accord/402 can use x402-compatible payment proof, but adds agreement and completion semantics."],
      ["Should I start with real payments?", "No. Start with local or testnet architecture demos."]
    ]
  },
  {
    slug: "paid-mcp-repo-audit-demo",
    title: "How to Run the Paid MCP Repository Audit Demo",
    description: "A practical walkthrough of the safest first Accord demo: the mock-rail paid MCP repository audit lifecycle.",
    eyebrow: "Tutorial",
    readTime: "7 min read",
    summary: "The paid MCP repository audit demo is the safest way to see the full Accord lifecycle without real funds.",
    takeaways: [
      "The demo runs with a mock rail.",
      "It exercises Agreement, Verification Receipt and Settlement Receipt objects.",
      "It is the recommended first hands-on path."
    ],
    sections: [
      {
        heading: "Why this demo comes first",
        body: [
          "The paid MCP repository audit example shows the Accord lifecycle without requiring an Ergo node, Base RPC, x402 facilitator or real funds. That makes it the right starting point for developers who want to understand the protocol before adding rail-specific complexity.",
          "It demonstrates the shape of a paid tool call, handler execution, verifier result and settlement record."
        ]
      },
      {
        heading: "Run it locally",
        body: [
          "Clone the repository, enter examples/15-paid-mcp-repo-audit, install dependencies and run npm run dev. The expected lifecycle is Agreement -> mock payment -> MCP wrapper -> handler -> verifier -> Verification Receipt -> Settlement Receipt.",
          "Treat this as a learning environment. It proves the flow, not production readiness."
        ]
      },
      {
        heading: "What to inspect",
        body: [
          "Look for the agreement hash, the payment or mock rail state, the verifier decision and the final settlement receipt. Those are the protocol records that matter.",
          "Once those are clear, teams can evaluate how their own verifier, buyer policy and rail assumptions should work."
        ]
      }
    ],
    faq: [
      ["Does the demo use real funds?", "No. It uses a mock rail."],
      ["Is it safe for production?", "No. It is a local learning demo."]
    ]
  },
  {
    slug: "agreement-object-explained",
    title: "The Accord Agreement Object Explained",
    description: "A plain-language guide to the Accord Agreement Object and the fields that define paid agent work.",
    eyebrow: "Protocol object",
    readTime: "8 min read",
    summary: "The Agreement Object is the canonical record of what the buyer and seller expect before work begins.",
    takeaways: [
      "The agreement is the anchor for payment, verification and settlement.",
      "Canonical hashing lets other records reference the same work terms.",
      "The object should be explicit enough for agents and policy engines."
    ],
    sections: [
      {
        heading: "The agreement anchors the lifecycle",
        body: [
          "Before a verifier can judge work or a rail can settle payment, the system needs a stable description of what was promised. The Accord Agreement Object provides that anchor.",
          "It can be canonicalized and hashed so payment proof, receipts and registry entries refer to the same terms."
        ]
      },
      {
        heading: "What it should contain",
        body: [
          "A useful agreement describes the buyer, seller, task, price, asset, deadline, verification rules, rail assumptions and acceptance criteria. Implementations may add references to outputs, policies or metadata, but the core purpose remains the same: make the work terms inspectable.",
          "Ambiguous agreements produce ambiguous verification. Clear agreements reduce downstream disputes."
        ]
      },
      {
        heading: "Why canonicalization matters",
        body: [
          "Agents need deterministic references. If two systems serialize the same terms differently, hashes and signatures can drift. Accord's canonical JSON and hashing rules are designed to make agreement references stable.",
          "That stability is what lets receipts and settlement records bind back to the original promise."
        ]
      }
    ],
    faq: [
      ["Is the Agreement Object the same as a payment request?", "No. It describes work terms; payment authority or proof is part of the broader lifecycle."],
      ["Why hash the agreement?", "Hashing gives receipts and rails a stable reference to the same canonical terms."]
    ]
  },
  {
    slug: "buyer-policy-agent-wallets",
    title: "Buyer Policy for Agent Wallets",
    description: "How buyer-side policy can limit agent spend and connect payment authority to Accord agreements and receipts.",
    eyebrow: "Policy",
    readTime: "7 min read",
    summary: "Buyer policy is the control layer that keeps agent spending bounded by agreement terms, limits and verifier outcomes.",
    takeaways: [
      "Agents need spending constraints before payment authority is granted.",
      "Policies can reference agreement hashes, recipients, rails and limits.",
      "Verification receipts can feed post-work decisions."
    ],
    sections: [
      {
        heading: "Autonomy needs limits",
        body: [
          "Agent wallets should not treat every tool call as equally safe. Buyers need policy caps for single payments, sessions, recipients, rails, assets, approval thresholds and daily exposure.",
          "Accord helps because payment authority can be scoped to a concrete work agreement rather than an unstructured prompt."
        ]
      },
      {
        heading: "What policy can check",
        body: [
          "A buyer policy engine can check whether the agreement hash is known, whether the seller is allowed, whether the rail is permitted, whether the amount is within limits and whether the verifier is acceptable.",
          "After work completes, the Verification Receipt can inform settlement, reputation or dispute behavior."
        ]
      },
      {
        heading: "Why policy is not optional",
        body: [
          "Any agent capable of initiating payments or settlement needs guardrails. Protocol objects improve auditability, but they do not replace spending policy, signer controls or operational review.",
          "The safest systems combine Accord records with strict buyer-side policy."
        ]
      }
    ],
    faq: [
      ["Does Accord provide a buyer policy package?", "The monorepo includes @accord-protocol/buyer-policy for buyer-side policy experiments."],
      ["Can policy make mainnet safe today?", "No. Policy helps control spend, but current mainnet status is still not certified."]
    ]
  },
  {
    slug: "what-conformance-does-not-prove",
    title: "What Accord Conformance Does Not Prove",
    description: "A safety-focused explanation of the limits of conformance testing and why compatibility is not production certification.",
    eyebrow: "Safety",
    readTime: "6 min read",
    summary: "Conformance is necessary for interoperability, but it is not a substitute for audits, verifier review or production operations.",
    takeaways: [
      "Conformance proves compatibility with current v0 rules.",
      "It does not prove verifier honesty or contract safety.",
      "Production readiness needs separate evidence."
    ],
    sections: [
      {
        heading: "Compatibility is not safety",
        body: [
          "Conformance checks whether an implementation follows Accord's current protocol expectations. That is valuable, but it is not the same as proving a rail, contract, verifier or wallet integration is safe for real funds.",
          "A system can pass conformance while still depending on risky operational assumptions."
        ]
      },
      {
        heading: "What remains outside conformance",
        body: [
          "External audits, verifier incentives, bridge risk, wallet security, signer operations, facilitator behavior, oracle assumptions and production incident response are outside the narrow meaning of conformance.",
          "Those topics need separate documentation and evidence."
        ]
      },
      {
        heading: "How to state it correctly",
        body: [
          "The correct claim is that conformance indicates compatibility with Accord v0 rules. It does not imply external audit completion, mainnet certification or suitability for production financial workflows.",
          "This language should remain consistent across docs, site copy and AI-facing summaries."
        ]
      }
    ],
    faq: [
      ["Should teams still run conformance?", "Yes. Conformance is essential for compatibility; it is just not sufficient for production safety."],
      ["Can conformance results be used in audits?", "They can be useful evidence, but they do not replace an audit."]
    ]
  }
);

articles.push(
  {
    slug: "base-sepolia-contract-rail-live-evidence",
    title: "Live Testnet Evidence: Accord Base Sepolia Contract Rail",
    description: "Accord completed a live Base Sepolia contract rail pilot with deployed contract evidence, testnet transactions, audit-gate checks and L4 conformance.",
    eyebrow: "Live evidence",
    readTime: "8 min read",
    summary: "A live Base Sepolia pilot proved the Accord agreement, verification and settlement lifecycle against an external EVM testnet contract.",
    takeaways: [
      "This was a live Base Sepolia testnet proof, not a local stub.",
      "The pilot issued, verified and redeemed an on-chain Note through AgentPayReserveV0.",
      "Mainnet remains default-deny until signed audit manifests explicitly allow exact deployed bytecode."
    ],
    sections: [
      {
        heading: "What changed",
        body: [
          "Accord completed a live Base Sepolia pilot for its EVM contract rail. The run used a deployed <code>AgentPayReserveV0</code> contract, Circle test USDC, live transaction hashes, Accord verification receipts, settlement receipts and conformance output.",
          "The goal was narrow and important: prove that an AI-agent payment flow can move from agreement to verification to settlement with external on-chain evidence."
        ]
      },
      {
        heading: "What was tested",
        body: [
          "The pilot validated a full paid-tool lifecycle. A buyer funded a Base Sepolia reserve with test USDC, Accord created an agreement for a paid task, the Base rail issued an on-chain Note, a verifier accepted the task output, the seller redeemed the Note and Accord produced a settlement receipt that referenced the verification receipt.",
          "The reserve contract used in the run was <code>0x08e27593a6e89ed04eB0eBAe249A460657d3Cc89</code>. The token contract was Circle test USDC at <code>0x036CbD53842c5426634e7929541eC2318f3dCF7e</code>."
        ]
      },
      {
        heading: "The receipt chain",
        body: [
          "The Accord record starts with an Agreement Object. That agreement binds the buyer, seller, task, price, rail and verification requirements. The live run then produced an accepted Verification Receipt for the task output and a settled Settlement Receipt for the redeemed Base Sepolia Note.",
          "The passing run also checked that a wrong task output was rejected with <code>TASK_HASH_MISMATCH</code>. That negative check matters because payment alone is not completion; settlement should remain bound to the verified work."
        ]
      },
      {
        heading: "External transaction evidence",
        body: [
          "The external evidence includes contract deployment, ERC-20 approval, reserve top-up, Note issuance and Note redemption on Base Sepolia. The settlement transaction is <a href=\"https://sepolia.basescan.org/tx/0xf6ab7267f1ff489524d06884effa045f9430858509348cbf30970f34cb741f92\" rel=\"noopener\" target=\"_blank\">0xf6ab7267f1ff489524d06884effa045f9430858509348cbf30970f34cb741f92</a>.",
          "The deployed reserve contract can be inspected on BaseScan at <a href=\"https://sepolia.basescan.org/address/0x08e27593a6e89ed04eb0ebae249a460657d3cc89\" rel=\"noopener\" target=\"_blank\">0x08e27593a6e89ed04eb0ebae249a460657d3cc89</a>."
        ]
      },
      {
        heading: "Safety posture",
        body: [
          "This pilot does not certify Accord for mainnet use. That boundary is deliberate. Base Sepolia writes are allowed for this testnet rail, but Base mainnet remains default-deny unless exact deployed bytecode is approved through signed audit manifests.",
          "The live run explicitly confirmed the audit gate: Base Sepolia writes were allowed, Base mainnet default writes were denied and the mainnet denial code was <code>UNAUDITED_CONTRACT</code>."
        ]
      },
      {
        heading: "Result",
        body: [
          "The pilot passed. Accord conformance reached L4: L0 26/26, L1 13/13, L2 24/24, L3 12/12 and L4 16/16.",
          "The important outcome is not that testnet tokens moved. The important outcome is that the movement was tied to an agreement, a verifier decision, a settlement receipt and a conservative mainnet gate."
        ]
      }
    ],
    faq: [
      ["Is this a mainnet launch?", "No. This is live Base Sepolia testnet evidence. Accord remains not certified for mainnet until signed audit manifests explicitly allow exact deployed bytecode."],
      ["What did the pilot prove?", "It proved a live agreement, verification and settlement lifecycle on the Base Sepolia EVM rail, including on-chain Note issuance and redemption."],
      ["Why does the audit gate matter?", "It prevents a successful testnet proof from being mistaken for permission to use unaudited mainnet contracts."]
    ],
    references: [
      {
        label: "Base Sepolia live pilot evidence",
        url: "https://github.com/accord-protocol/accord-protocol/blob/main/docs/pilots/results/2026-05-23-base-sepolia-contract-rail.md",
        note: "Dated pilot record with receipts, transaction links, audit-gate result and conformance output."
      },
      {
        label: "AgentPayReserveV0 on Base Sepolia",
        url: "https://sepolia.basescan.org/address/0x08e27593a6e89ed04eb0ebae249a460657d3cc89",
        note: "Deployed reserve contract used for the live testnet rail pilot."
      },
      {
        label: "Settlement transaction",
        url: "https://sepolia.basescan.org/tx/0xf6ab7267f1ff489524d06884effa045f9430858509348cbf30970f34cb741f92",
        note: "Live Base Sepolia redemption transaction from the passing run."
      }
    ]
  },
  {
    slug: "agent-payments-stack",
    title: "The Agent Payments Stack: MCP, x402, AP2 and Accord",
    description: "A practical map of the agent payments stack: MCP for tool access, x402 for HTTP payment, AP2 for payment authority and Accord for work verification.",
    eyebrow: "Market map",
    readTime: "11 min read",
    summary: "Agent payments are not one protocol. They are a stack of tool access, payment authority, payment execution, work verification, settlement evidence and policy.",
    takeaways: [
      "MCP connects agents to tools, but does not define paid-work acceptance criteria.",
      "x402 handles HTTP-native payment flows, but payment success is not the same as work completion.",
      "AP2-style authority can prove intent to transact, while Accord records the work agreement and receipts."
    ],
    sections: [
      {
        heading: "The mistake is looking for one protocol",
        body: [
          "Agent payments sound like a single problem until a real workflow touches money. A buyer agent needs to discover a tool, understand price, receive authority to spend, prove or execute payment, get the work, verify whether the work matched the request and record what happened for audit or settlement.",
          "No single layer should own all of that. The healthier architecture is a stack. MCP handles tool connectivity. x402 handles HTTP-native payment mechanics. AP2-style flows help express payment authority and intent. Accord records the work terms, verification result and settlement evidence around the task."
        ]
      },
      {
        heading: "MCP is the tool interface, not the commercial record",
        body: [
          "The Model Context Protocol gives applications and agents a common way to expose tools, resources and prompts. That is a major step for interoperability because tool calling stops being a private integration for every client and server pair.",
          "But a tool interface does not answer the commercial questions: what exactly was purchased, what output counts as complete, what verifier is acceptable, what happens if the output fails and how should settlement evidence be recorded. Those questions need a work-agreement layer."
        ]
      },
      {
        heading: "x402 is the payment mechanism, not the completion mechanism",
        body: [
          "x402 makes the HTTP 402 Payment Required status useful for programmatic payments. A client requests a resource, receives payment requirements, sends a payment payload and the server or facilitator verifies and settles the payment before returning the resource.",
          "That is powerful for paid API calls, content access and machine-to-machine payments. It is still not enough for outcome-oriented work. A repository audit, model evaluation, data cleanup or compliance review can be paid for and still be incomplete, low quality or rejected under the buyer's acceptance criteria."
        ]
      },
      {
        heading: "AP2-style authority answers who allowed the payment",
        body: [
          "Agent-led payments need a way to show that an agent had authority to transact. AP2-style mandates and payment authority records are useful because they move the ecosystem away from vague trust in a chatbot and toward auditable intent.",
          "Authority still does not equal completion. A user can authorize an agent to buy a service, and the service can receive payment, while the actual work still needs a task record, verifier verdict and settlement trail."
        ]
      },
      {
        heading: "Accord is the work layer",
        body: [
          "Accord exists for the space between payment and finished work. The Agreement Object records the task, price, parties, deadline, verifier and rail assumptions. The Verification Receipt records whether the output was accepted, rejected or partially accepted. The Settlement Receipt records the economic closeout and rail evidence.",
          "That separation makes the agent payments stack inspectable. A payment protocol can do payment well. A tool protocol can do tool access well. Accord can do work verification and receipt semantics without pretending to be a wallet, facilitator, bank or payment network."
        ]
      },
      {
        heading: "A clean reference architecture",
        body: [
          "A robust agent payment flow should be assembled in this order: discover the tool, construct the agreement, check buyer policy, grant or reference payment authority, verify or execute payment, run the work, verify the output, then write settlement evidence. Each layer should have a clear artifact that later systems can inspect.",
          "The result is not just a successful request. It is an audit trail that says what the agent was allowed to buy, what was promised, what was delivered, who checked it and what settlement evidence exists."
        ]
      }
    ],
    faq: [
      ["Is Accord a replacement for MCP, x402 or AP2?", "No. Accord is designed to compose with tool, payment and authority layers. It records paid-work terms, verification and settlement receipts."],
      ["What is the shortest way to explain the difference?", "MCP connects tools. x402 verifies payment. AP2-style flows express authority. Accord verifies completion."],
      ["Which layer should a developer start with?", "Start with the work lifecycle: define what the buyer expects, how the result will be verified and which payment or authority layer will be referenced."]
    ],
    references: [
      {
        label: "Model Context Protocol repository",
        url: "https://github.com/modelcontextprotocol/modelcontextprotocol",
        note: "Official MCP repository containing the specification, protocol schema and documentation."
      },
      {
        label: "x402 Foundation repository",
        url: "https://github.com/x402-foundation/x402",
        note: "Open x402 implementation and specification source for HTTP-native payment flows."
      },
      {
        label: "Google Cloud AP2 announcement",
        url: "https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol",
        note: "Google's announcement of AP2 as an open protocol for secure agent-led payments across platforms."
      }
    ]
  },
  {
    slug: "payment-verification-vs-work-verification",
    title: "Payment Verification Is Not Work Verification",
    description: "Why paid AI agent systems need separate records for payment, promised work, verifier decisions and settlement evidence.",
    eyebrow: "Principle",
    readTime: "10 min read",
    summary: "A payment receipt can prove that value moved. It does not prove that the paid work met the buyer's acceptance criteria.",
    takeaways: [
      "Payment answers whether a buyer satisfied a payment condition.",
      "Work verification answers whether the delivered output matched the agreement.",
      "Safe agent systems should keep payment proof and verification receipts separate."
    ],
    sections: [
      {
        heading: "The successful payment trap",
        body: [
          "A common agent-commerce failure mode is treating a successful payment as a successful job. That feels natural because many web products are access-based: pay the fee, unlock the resource, transaction complete. Agent work is different. The buyer often wants an outcome, not merely access.",
          "If an agent pays for a code audit, the payment event says the seller was paid or authorized. It does not say the audit covered the requested repository, found the relevant risks, followed the requested format or met the agreed deadline."
        ]
      },
      {
        heading: "Payment proof is usually local to the rail",
        body: [
          "A payment proof is shaped by its rail. In x402 it may involve HTTP payment requirements, a payment payload, facilitator verification and settlement. On a chain-based rail it may involve a transaction, note, box, contract call or token movement. In a mock rail it may be deterministic local state for a demo.",
          "Those proofs are important, but they usually answer rail questions: was the payload valid, was the amount sufficient, was the transaction accepted, did the facilitator settle, did the note redeem. They do not carry the full semantics of the work."
        ]
      },
      {
        heading: "Work verification is scoped to an agreement",
        body: [
          "Work verification needs a different anchor: the Agreement Object. The agreement names the buyer and seller, defines the task, sets the price and deadline, identifies the verifier and explains the acceptance policy. A Verification Receipt can then bind a verdict to that canonical agreement.",
          "That receipt can say accepted, rejected or partially accepted. Each result matters. Rejections are not failures of the protocol; they are useful evidence that the verifier evaluated the work and found it did not meet the terms."
        ]
      },
      {
        heading: "The accounting trail needs both",
        body: [
          "A system that keeps only payment proof cannot explain why the payment was justified. A system that keeps only verifier output cannot explain whether the economic side settled. Production-grade agent workflows need both records and the relationship between them.",
          "Accord separates Agreement Object, Verification Receipt and Settlement Receipt for exactly this reason. The task, verdict and closeout are different facts and should be inspected independently."
        ]
      },
      {
        heading: "How to design for disputes",
        body: [
          "Disputes become easier when each artifact is scoped. If the buyer claims the work was wrong, inspect the agreement and verification receipt. If the seller claims payment failed, inspect the rail evidence and settlement receipt. If the agent exceeded authority, inspect buyer policy and payment mandate references.",
          "This is the difference between logs and protocol records. Logs are useful for operators. Protocol records are useful for independent systems trying to reason about what happened."
        ]
      }
    ],
    faq: [
      ["Can a payment protocol include work metadata?", "It can include descriptions or references, but payment validation and work acceptance are still different claims with different trust assumptions."],
      ["Why not put everything in one receipt?", "One combined receipt makes the lifecycle harder to inspect. Separate records let payment, verification and settlement fail or succeed independently."],
      ["Is a Verification Receipt objective proof of quality?", "No. It records a verifier's verdict under the agreement's rules. The verifier's trust model must still be documented."]
    ],
    references: [
      {
        label: "Coinbase x402 documentation",
        url: "https://docs.cdp.coinbase.com/x402/welcome",
        note: "Describes x402 as an HTTP payment protocol for programmatic payments and paid API/content access."
      },
      {
        label: "Accord Verification Receipt schema",
        url: "https://accordprotocol.ai/schemas/verification-receipt.v0.schema.json",
        note: "Canonical public schema for Accord v0 verification receipt shape."
      },
      {
        label: "Accord Settlement Receipt schema",
        url: "https://accordprotocol.ai/schemas/settlement-receipt.v0.schema.json",
        note: "Canonical public schema for Accord v0 settlement receipt shape."
      }
    ]
  },
  {
    slug: "paid-mcp-tools-production-checklist",
    title: "Production Checklist for Paid MCP Tools",
    description: "A builder checklist for paid MCP tools covering agreements, pricing, buyer policy, verifier design, receipts, replay protection and audit gates.",
    eyebrow: "Checklist",
    readTime: "12 min read",
    summary: "Before an MCP tool handles real economic value, the team needs explicit work terms, policy limits, verifier assumptions, replay protection and settlement evidence.",
    takeaways: [
      "A paid MCP tool needs more than a price and a handler.",
      "The buyer should know exactly what output is promised and how it will be verified.",
      "Production posture depends on audits, signer controls, rail assumptions and incident response."
    ],
    sections: [
      {
        heading: "Start with the unit of work",
        body: [
          "The first production question is not what the tool costs. It is what the buyer is paying to receive. A summarizer, code auditor, data extractor and research agent all have different acceptance criteria. If the unit of work is vague, the payment flow will look clean while the product remains impossible to verify.",
          "Define the task kind, input references, expected output format, deadline, refund or rejection policy and verifier. Put those terms in an Agreement Object before the tool runs."
        ]
      },
      {
        heading: "Separate access pricing from outcome pricing",
        body: [
          "Some tools sell access. Others sell an outcome. Access pricing can be simple: pay for this API response. Outcome pricing needs richer semantics: pay if the output passes tests, refund on timeout, partially accept if a subset of tasks complete, or require a human verifier for high-value work.",
          "Do not hide outcome rules in marketing copy or prompt text. They should be machine-readable enough for buyer policy and receipts to inspect."
        ]
      },
      {
        heading: "Add buyer policy before signer access",
        body: [
          "Any paid MCP tool that can trigger a wallet, facilitator, credit account or settlement rail should meet a buyer-side policy first. Minimum controls include max single payment, max session spend, allowed sellers, allowed rails, approved verifiers and approval-required thresholds.",
          "Policy should run before the signer sees the transaction or payment payload. Once an agent can reach a signer directly, the system has already lost one of its strongest safety boundaries."
        ]
      },
      {
        heading: "Design the verifier like a product surface",
        body: [
          "A verifier is not an implementation detail. It is the thing buyers will trust when deciding whether work was accepted. For deterministic tasks, tests or schemas may be enough. For subjective tasks, use a human review, committee, rubric or model evaluator with clear limits.",
          "The Verification Receipt should record the verdict and bind it to the agreement. It should not pretend to prove more than the verifier actually checked."
        ]
      },
      {
        heading: "Protect against replay and receipt drift",
        body: [
          "Paid tools need stable agreement hashes, nonce or payment identifiers, replay storage and consistent canonicalization. The same payment should not authorize multiple executions unless the agreement explicitly allows that behavior.",
          "Receipt drift is another risk. If the agreement, verifier output and settlement evidence are generated by different components, make sure they all reference the same canonical agreement hash."
        ]
      },
      {
        heading: "Keep production claims audit-gated",
        body: [
          "A demo that works locally is not production-ready. A testnet rail that settles once is not mainnet-certified. A passing conformance suite is not an external audit. A professional paid MCP launch should state these boundaries clearly.",
          "For Accord today, the correct public posture remains alpha / testnet-first and NOT CERTIFIED FOR MAINNET. The safest first path is the mock paid MCP repository audit demo."
        ]
      }
    ],
    faq: [
      ["Can a paid MCP tool launch with only x402?", "It can sell paid access, but outcome-oriented work still needs terms, verification and settlement records if the buyer cares about completion."],
      ["What should be logged for every paid tool call?", "Agreement hash, payment or authority reference, replay identifier, handler output reference, verifier verdict and settlement evidence."],
      ["What is the safest first demo path?", "Use the mock rail paid MCP repository audit demo before moving to testnet or facilitator-backed payment flows."]
    ],
    references: [
      {
        label: "Model Context Protocol repository",
        url: "https://github.com/modelcontextprotocol/modelcontextprotocol",
        note: "Official MCP specification and documentation source."
      },
      {
        label: "Accord/MCP package",
        url: "https://github.com/accord-protocol/accord-protocol/tree/main/packages/accord-mcp",
        note: "Reference Accord/MCP wrapper package for paid and verifiable MCP tool calls."
      },
      {
        label: "Paid MCP repository audit demo",
        url: "https://github.com/accord-protocol/accord-protocol/tree/main/examples/15-paid-mcp-repo-audit",
        note: "Recommended local demo for the complete agreement, verification and settlement lifecycle."
      }
    ]
  },
  {
    slug: "verifier-design-paid-agent-work",
    title: "How to Design Verifiers for Paid Agent Work",
    description: "A practical guide to verifier design for paid AI agent workflows: deterministic tests, human review, model graders, committees and receipt boundaries.",
    eyebrow: "Verifier design",
    readTime: "12 min read",
    summary: "The verifier is the trust boundary between delivered work and settlement. Good verifier design is explicit, scoped and honest about what it can prove.",
    takeaways: [
      "A verifier should be chosen from the task's acceptance criteria, not from convenience.",
      "Verification Receipts record verdicts; they do not magically make a verifier trustworthy.",
      "High-value workflows need documented verifier assumptions and fallback paths."
    ],
    sections: [
      {
        heading: "Verification is where product quality meets protocol design",
        body: [
          "A paid agent system can have elegant payment plumbing and still fail if verification is weak. The verifier decides whether the output matched the agreement. That decision drives settlement, reputation, retries, refunds and dispute paths.",
          "Treat verifier design as a first-class product surface. Buyers should be able to understand who or what judged the work, what evidence was used and what the verdict means."
        ]
      },
      {
        heading: "Match the verifier to the task",
        body: [
          "Deterministic tasks should use deterministic checks whenever possible: schema validation, unit tests, snapshot comparison, hash checks, static analysis or reproducible scoring. Subjective tasks need a different approach: rubrics, human review, model-assisted review or a committee.",
          "Do not use a model grader where a test suite would be stronger. Do not use a single brittle test where a human or committee is required. The verifier should fit the risk and ambiguity of the work."
        ]
      },
      {
        heading: "Record verdicts, not vibes",
        body: [
          "A professional Verification Receipt should identify the agreement, verifier, verdict, time, relevant output references and signature material. The receipt should say accepted, rejected or partially accepted in a way that downstream systems can parse.",
          "Free-form commentary can help humans, but policy engines need structured verdicts and stable references."
        ]
      },
      {
        heading: "Partial acceptance is not a corner case",
        body: [
          "Many agent tasks are divisible. A repository audit may complete dependency review but not threat modeling. A data transformation may convert most rows but reject a malformed subset. A research job may produce the primary report but miss a required appendix.",
          "Partial acceptance lets the protocol preserve nuance. It avoids pretending every job is binary while still giving settlement policy something concrete to evaluate."
        ]
      },
      {
        heading: "Verifier risk should be visible",
        body: [
          "Verifier compromise, biased scoring, prompt injection, missing context, weak tests and conflicts of interest are real risks. Accord can record the verifier's claim, but it cannot make that verifier honest.",
          "Production systems should document verifier assumptions, approval thresholds, appeal paths and when a human review is required. The higher the payment or downstream consequence, the stronger that process should be."
        ]
      },
      {
        heading: "A useful minimum standard",
        body: [
          "For each paid workflow, define the verifier identity, input evidence, output reference, verdict vocabulary, signature method, timeout behavior and dispute route. Then test rejected and partially accepted paths, not only the happy path.",
          "The goal is not to eliminate every dispute. The goal is to make disputes inspectable."
        ]
      }
    ],
    faq: [
      ["Can an LLM be a verifier?", "Yes, but only when its limits are documented and the workflow accepts model-judgment risk. High-value work may need human or deterministic review."],
      ["Is a verifier the same as an auditor?", "No. A verifier judges a specific work output under a specific agreement. An auditor evaluates broader system safety or correctness."],
      ["Why does Accord allow partial acceptance?", "Because many agent tasks produce mixed outcomes, and settlement policy may need more nuance than accepted or rejected."]
    ],
    references: [
      {
        label: "Accord Verification Receipt schema",
        url: "https://accordprotocol.ai/schemas/verification-receipt.v0.schema.json",
        note: "Public schema for the Accord v0 verifier verdict object."
      },
      {
        label: "What Accord Conformance Does Not Prove",
        url: "https://accordprotocol.ai/learn/what-conformance-does-not-prove/",
        note: "Explains why compatibility checks do not prove verifier honesty or production safety."
      },
      {
        label: "Accord conformance package",
        url: "https://github.com/accord-protocol/accord-protocol/tree/main/packages/accord-conformance",
        note: "Reference package for testing Accord compatibility levels."
      }
    ]
  },
  {
    slug: "agent-wallet-policy",
    title: "Agent Wallet Policy: How to Keep Autonomous Spend Bounded",
    description: "A guide to buyer-side policy for agent wallets: spend caps, recipient allow-lists, rails, approvals, signer isolation and receipt-aware settlement.",
    eyebrow: "Policy",
    readTime: "11 min read",
    summary: "Autonomous spend is only acceptable when the buyer controls who can be paid, how much, on which rail and under what verification rules.",
    takeaways: [
      "Never let an agent reach an unrestricted signer.",
      "Policy should evaluate agreement terms before payment authority is granted.",
      "Verification and settlement receipts can feed post-work policy decisions."
    ],
    sections: [
      {
        heading: "The signer is not the policy engine",
        body: [
          "A signer can produce a valid payment authorization. It does not know whether the agent should be allowed to spend. If the policy lives only in prompts, natural-language instructions or a UI checkbox, the payment system is too fragile for autonomous workflows.",
          "Buyer policy should sit before the signer and evaluate structured facts: agreement hash, seller identity, rail, asset, amount, deadline, verifier and session budget."
        ]
      },
      {
        heading: "Minimum controls for autonomous payments",
        body: [
          "Every buyer-side agent wallet should enforce max single payment, max session spend, optional daily spend, allowed recipients, allowed rails, allowed currencies and approval thresholds. These are not advanced features; they are baseline blast-radius controls.",
          "The policy should also treat unknown sellers, unknown verifiers and missing agreement hashes as deny-by-default conditions."
        ]
      },
      {
        heading: "Agreement-scoped authority",
        body: [
          "Payment authority should be scoped to a specific work agreement whenever possible. That prevents an agent from reusing a broad permission for a different task, seller or price.",
          "In Accord terms, the Agreement Object becomes the anchor that buyer policy can inspect before any payment payload, transaction or mandate is created."
        ]
      },
      {
        heading: "Approvals should be structured",
        body: [
          "Human approval is valuable, but only when the human sees the right facts. The approval prompt should include seller, task, amount, rail, deadline, verifier and risk posture. It should not ask the user to approve an opaque transaction blob without context.",
          "Approval responses should be recorded with enough structure to explain later why the signer was allowed to act."
        ]
      },
      {
        heading: "Post-work policy matters too",
        body: [
          "Policy does not end when the payment is authorized. Verification Receipts and Settlement Receipts can influence reputation, refunds, retry logic, limits for future sessions and escalation to human review.",
          "A rejected receipt should not look the same as a missing receipt. A partial acceptance should not look the same as a clean success. The policy engine needs those distinctions."
        ]
      },
      {
        heading: "Design for failure first",
        body: [
          "The serious failures are predictable: agent overpays, pays the wrong seller, repeats the same payment, accepts weak verifier output, signs on an unsupported rail or settles without a receipt. A good policy design has explicit answers for each case before launch.",
          "The safest posture is boring: deny by default, cap aggressively, approve high-value work manually and preserve receipts."
        ]
      }
    ],
    faq: [
      ["Can prompt instructions replace wallet policy?", "No. Prompts are not a reliable spending control. Payment policy should run as code before signer access."],
      ["What should a policy inspect first?", "The Agreement Object and buyer session limits. If the agreement is unknown or out of policy, payment should not proceed."],
      ["Does buyer policy make mainnet use safe by itself?", "No. Policy limits blast radius, but mainnet readiness still requires audit evidence and operational controls."]
    ],
    references: [
      {
        label: "Accord buyer-policy package",
        url: "https://github.com/accord-protocol/accord-protocol/tree/main/packages/accord-buyer-policy",
        note: "Reference buyer-side policy package for spend limits, allow-lists and signer wrapping."
      },
      {
        label: "Google Cloud AP2 announcement",
        url: "https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol",
        note: "Frames the need for secure, auditable agent-led payment authority."
      },
      {
        label: "Accord Agreement schema",
        url: "https://accordprotocol.ai/schemas/agreement.v0.schema.json",
        note: "Canonical public schema for Accord v0 work agreements."
      }
    ]
  },
  {
    slug: "conformance-audit-mainnet-checklist",
    title: "Conformance, Audits and Mainnet Gates for Agent Payment Rails",
    description: "How to separate Accord compatibility, external audits, rail risk, verifier assumptions and mainnet readiness for agent payment systems.",
    eyebrow: "Safety",
    readTime: "11 min read",
    summary: "Conformance is necessary for interoperability, but mainnet readiness requires separate audit evidence, rail review, verifier review and operational controls.",
    takeaways: [
      "Conformance means the implementation matches protocol expectations.",
      "Audit evidence evaluates broader safety, rail and contract assumptions.",
      "Mainnet permission should remain deny-by-default until signed evidence allows it."
    ],
    sections: [
      {
        heading: "Compatibility is the first gate, not the last gate",
        body: [
          "Conformance tells builders whether their objects, transports, rails, security checks and registry metadata match Accord's current v0 expectations. That is essential for interoperability. It is also easy to overstate.",
          "A compatible implementation can still have a vulnerable contract, weak signer operations, bad verifier incentives, bridge risk, replay gaps or poor incident response."
        ]
      },
      {
        heading: "What conformance should prove",
        body: [
          "Conformance should prove that an implementation speaks the protocol correctly. Agreement objects should validate. Receipts should bind to the correct agreement. Rail adapters should expose the expected behavior. Registry metadata should be coherent. Security guardrails should exist where the protocol expects them.",
          "That is a strong claim, but it is not the same as saying real funds are safe."
        ]
      },
      {
        heading: "What audits must cover separately",
        body: [
          "External audits should evaluate code paths and assumptions that conformance cannot prove: smart contracts, ErgoScript or EVM behavior, facilitator trust, bridge assumptions, signer isolation, private-key handling, verifier incentives and operational recovery.",
          "The audit scope should name exact artifacts. A vague audit badge is not enough for a rail that can move value."
        ]
      },
      {
        heading: "Why signed manifests are better than vibes",
        body: [
          "A signed audit manifest gives software and operators something concrete to check. It can say which script hash, bytecode, package version or deployment is covered and whether mainnet use is allowed.",
          "Without that explicit evidence, the safer default is denial. This is especially important for agent systems because agents can act quickly, repeatedly and without the judgment a human would apply to every transaction."
        ]
      },
      {
        heading: "A mainnet readiness checklist",
        body: [
          "Before a real-fund rail launch, require passing conformance, signed audit evidence, documented verifier assumptions, buyer policy caps, signer isolation, replay protection, incident response, monitoring, rollback paths and public status language that does not overclaim.",
          "The checklist should include negative tests and failure drills. Happy-path settlement evidence is useful, but production credibility comes from knowing what happens when something fails."
        ]
      },
      {
        heading: "The current Accord posture",
        body: [
          "Accord v0 is alpha / testnet-first and NOT CERTIFIED FOR MAINNET. That is not weak positioning; it is professional positioning. It tells developers where the system is useful today and where stronger evidence is still required.",
          "The right path is to make local demos, conformance and testnet work excellent while keeping production claims gated by signed evidence."
        ]
      }
    ],
    faq: [
      ["Does passing L4 conformance mean production-ready?", "No. It means registry and compatibility checks pass. Production readiness requires separate audit and operational evidence."],
      ["Why use signed audit manifests?", "They let software and operators check exact covered artifacts instead of relying on broad claims."],
      ["Can testnet evidence support a future audit?", "Yes. Testnet evidence is useful, but it does not replace external review or mainnet-specific risk assessment."]
    ],
    references: [
      {
        label: "Accord conformance package",
        url: "https://github.com/accord-protocol/accord-protocol/tree/main/packages/accord-conformance",
        note: "Reference L0-L4 conformance tooling for Accord implementations."
      },
      {
        label: "Accord audit docs",
        url: "https://github.com/accord-protocol/accord-protocol/tree/main/docs/audit",
        note: "Repository audit-gate materials and manifest format documentation."
      },
      {
        label: "ErgoScript documentation",
        url: "https://docs.ergoplatform.com/dev/scs/ergoscript/",
        note: "Official ErgoScript documentation for understanding Ergo's contract model and eUTXO assumptions."
      }
    ]
  }
);

const staticPages = [
  {
    slug: "status",
    title: "Accord Protocol Status",
    description: "Current Accord Protocol status: v0 draft, testnet-first, not certified for mainnet, with package and rail posture.",
    eyebrow: "Status",
    summary: "The public source of truth for Accord's website posture: useful today for local demos, testnets and conformance, not mainnet production.",
    sections: [
      {
        heading: "Executive status",
        body: [
          "Accord Protocol v0 is alpha, testnet-first software. The v0.4.2 package line is published, and it is appropriate for local demos, mock-rail flows, conformance testing, MCP tool-gating prototypes, Accord/402 architecture demos and controlled testnet experiments.",
          "The P4 pilot matrix is complete for the current scope: mock, Ergo testnet, Rosen architecture, x402 local facilitator and Base Sepolia contract rail all have dated result records. Sage also has a live full receipt recheck with schema-valid public JSON and L1 conformance. Mainnet status is still NOT CERTIFIED FOR MAINNET. Production use is blocked until signed audit manifests mark relevant scripts or contracts mainnetAllowed: true."
        ]
      },
      {
        heading: "Rail posture",
        body: [
          "The Ergo, Rosen and Base/EVM reference rails are testnet-first and audit-gated. The Base Sepolia contract rail now has live external transaction evidence, but Base mainnet remains default-deny. The x402-compatible rail is an integration rail whose trust depends on facilitator proof, replay protection and deployment policy.",
          "Passing conformance and passing testnet pilots do not mean audit completion or production safety.",
          "The rail-by-rail operating view is tracked in <a href=\"https://github.com/accord-protocol/accord-protocol/blob/main/docs/RAIL_MATURITY_MATRIX.md\" rel=\"noopener\" target=\"_blank\">docs/RAIL_MATURITY_MATRIX.md</a>, and the public mainnet certification posture is tracked in <a href=\"https://github.com/accord-protocol/accord-protocol/blob/main/docs/audit/\" rel=\"noopener\" target=\"_blank\">docs/audit/</a>."
        ]
      },
      {
        heading: "Recommended use today",
        body: [
          "Use Accord today for protocol review, local examples, mock rail demos, conformance testing, signed receipt inspection and testnet development.",
          "Do not use unaudited Accord rails, Note/Reserve/Tracker scripts, EVM reserve contracts or acceptance predicates for real-fund production workflows.",
          "Broad public launch posts and mcp.so distribution are deferred until the launch readiness gates pass. That gate is about polish and evidence presentation, not protocol failure."
        ]
      }
    ]
  },
  {
    slug: "security",
    title: "Accord Protocol Security",
    description: "Security posture and reporting guidance for Accord Protocol, including audit-gated mainnet policy and threat boundaries.",
    eyebrow: "Security",
    summary: "Accord's security posture is intentionally conservative: testnet-first, audit-gated and explicit about trust boundaries.",
    sections: [
      {
        heading: "Security posture",
        body: [
          "Accord Protocol is not currently certified for mainnet production use. Mainnet writes should remain blocked until relevant scripts or contracts appear in signed audit manifests with mainnetAllowed: true.",
          "The website preserves this language so humans and agents do not overstate readiness."
        ]
      },
      {
        heading: "Threat boundaries",
        body: [
          "Verifier design, signer behavior, wallet security, bridge assumptions, facilitator proof, replay protection and rail-specific script correctness are separate trust boundaries.",
          "Accord records work agreements and receipts. It does not remove the need for audits, policy caps, operational monitoring or incident response."
        ]
      },
      {
        heading: "Reporting",
        body: [
          "Security-sensitive reports should use GitHub private vulnerability reporting or the channels described in the repository SECURITY.md. Public issues are not appropriate for exploitable vulnerabilities.",
          "Reports should include affected components, reproduction steps, expected impact and whether public credit is requested."
        ]
      }
    ]
  },
  {
    slug: "roadmap",
    title: "Accord Protocol Roadmap",
    description: "Accord Protocol roadmap: build the open trust and receipt layer for agent commerce while keeping mainnet audit gates explicit.",
    eyebrow: "Roadmap",
    summary: "A conservative roadmap for turning Accord's completed testnet evidence into the open trust and receipt layer for agent commerce.",
    sections: [
      {
        heading: "North Star",
        body: [
          "Accord should become the open trust and receipt layer for the agent economy: the standard place where agents can agree on work, authorize payment through any compatible rail, verify completion, emit signed receipts, pass conformance and remain legible to wallets, providers, registries and auditors.",
          "The unit is not only payment. The unit is the full work lifecycle: agree, authorize or pay, perform, verify, receipt and settle.",
          "The full strategic frame is tracked in <a href=\"https://github.com/accord-protocol/accord-protocol/blob/main/docs/STRATEGIC_NORTH_STAR.md\" rel=\"noopener\" target=\"_blank\">docs/STRATEGIC_NORTH_STAR.md</a>."
        ]
      },
      {
        heading: "Near-term priorities",
        body: [
          "The near-term roadmap is to build on the narrow v0.4.2 evidence release, stabilize v0 protocol docs, keep package APIs coherent, make the canonical developer path easier to run and polish the public proof narrative before broad launch.",
          "The most important next move is not adding dozens of features. It is turning the existing testnet evidence into trust: launch readiness, audit evidence, provider onboarding, rail maturity and then controlled mainnet.",
          "Rail maturity is tracked as an explicit operating matrix, so mock, Sage Ergo, Base Sepolia, x402 and Rosen are presented by purpose, evidence, receipt surface, conformance, risk boundary and mainnet gate.",
          "The public audit/mainnet gate is documented in <a href=\"https://github.com/accord-protocol/accord-protocol/blob/main/docs/audit/\" rel=\"noopener\" target=\"_blank\">docs/audit/</a>: manifests must remain default-deny until exact artifacts are externally audited and marked mainnetAllowed: true.",
          "The remaining work is now issue-backed: pre-launch polish and final distribution are tracked in <a href=\"https://github.com/accord-protocol/accord-protocol/issues/70\" rel=\"noopener\" target=\"_blank\">#70</a>, external audits and signed mainnet manifests in <a href=\"https://github.com/accord-protocol/accord-protocol/issues/72\" rel=\"noopener\" target=\"_blank\">#72</a>, and Rosen workspace promotion in <a href=\"https://github.com/accord-protocol/accord-protocol/issues/73\" rel=\"noopener\" target=\"_blank\">#73</a>.",
          "The website, learn pages and mobile experience now support discovery, but the protocol source of truth remains the repository specs, status docs and GitHub tracker."
        ]
      },
      {
        heading: "Developer experience",
        body: [
          "Developer work should focus on one golden path: run the mock rail paid MCP demo, inspect Agreement / Verification / Settlement receipts, run conformance, then optionally inspect Base Sepolia live evidence.",
          "The mock rail paid MCP demo remains the best first hands-on path; Base Sepolia is the proof that the lifecycle can also bind to an external EVM testnet rail.",
          "Sage has live Ergo testnet settlement evidence and a public full receipt bundle that now passes npm run pilots:sage:live against schema-valid public JSON, hash binding, semantic checks and L1 conformance.",
          "The next adoption surface is provider onboarding: a third-party API, MCP tool or agent service should be able to become Accord-compatible by following the public guide, emitting receipt JSON and publishing conformance evidence."
        ]
      },
      {
        heading: "Launch sequencing",
        body: [
          "Broad launch is intentionally deferred. Search Console, Bing, HN, Reddit, X, Discord and mcp.so should happen after the launch readiness gates pass, not before.",
          "The launch-readiness gate requires source-of-truth consistency, a polished golden path, Sage/Base proof narratives, provider onboarding, audit posture, mobile/site polish and drafts that do not overclaim mainnet readiness."
        ]
      },
      {
        heading: "Production path",
        body: [
          "Production mainnet support depends on external audit evidence, signed manifests, operational controls and rail-specific review. That P5 blocker is tracked in <a href=\"https://github.com/accord-protocol/accord-protocol/issues/72\" rel=\"noopener\" target=\"_blank\">#72</a>; detailed audit work papers are kept private.",
          "Until those gates are complete, Accord should remain positioned as a testnet-first reference implementation and open standard."
        ]
      }
    ]
  }
];

const learnGroups = [
  {
    label: "Start here",
    description: "The fastest path from the agent payments stack to a runnable Accord lifecycle.",
    slugs: ["agent-payments-stack", "payment-verification-vs-work-verification", "agent-work-agreements", "paid-mcp-repo-audit-demo"]
  },
  {
    label: "Build",
    description: "Implementation guides for paid tools, HTTP flows, verifiers and rail adapters.",
    slugs: ["paid-mcp-tools-production-checklist", "accord-mcp-paid-tools", "accord-402-flow", "rail-adapters", "provider-onboarding"]
  },
  {
    label: "Compare",
    description: "How Accord relates to adjacent payment, authorization and tool layers.",
    slugs: ["accord-vs-x402", "accord-vs-mcp", "accord-vs-ap2"]
  },
  {
    label: "Trust and safety",
    description: "Verifier design, wallet policy, conformance and audit gates for safer agent payments.",
    slugs: ["launch-readiness-gates", "verifier-design-paid-agent-work", "agent-wallet-policy", "conformance-audit-mainnet-checklist", "conformance-levels", "audit-gated-mainnet", "what-conformance-does-not-prove", "buyer-policy-agent-wallets"]
  },
  {
    label: "Reference rails",
    description: "Settlement receipt design, Ergo and the rail-agnostic Accord model.",
    slugs: ["base-sepolia-contract-rail-live-evidence", "settlement-receipts", "verification-receipts", "why-ergo-reference-rail"]
  }
];

const relatedBySlug = {
  "base-sepolia-contract-rail-live-evidence": ["rail-adapters", "conformance-levels", "audit-gated-mainnet"],
  "agent-payments-stack": ["payment-verification-vs-work-verification", "accord-vs-x402", "accord-vs-ap2"],
  "payment-verification-vs-work-verification": ["verification-receipts", "settlement-receipts", "agent-work-agreements"],
  "paid-mcp-tools-production-checklist": ["accord-mcp-paid-tools", "agent-wallet-policy", "verifier-design-paid-agent-work"],
  "verifier-design-paid-agent-work": ["verification-receipts", "what-conformance-does-not-prove", "paid-mcp-tools-production-checklist"],
  "agent-wallet-policy": ["buyer-policy-agent-wallets", "accord-vs-ap2", "payment-verification-vs-work-verification"],
  "conformance-audit-mainnet-checklist": ["conformance-levels", "audit-gated-mainnet", "what-conformance-does-not-prove"],
  "agent-work-agreements": ["agreement-object-explained", "verification-receipts", "settlement-receipts"],
  "accord-vs-x402": ["accord-402-flow", "verification-receipts", "settlement-receipts"],
  "verification-receipts": ["agreement-object-explained", "settlement-receipts", "what-conformance-does-not-prove"],
  "settlement-receipts": ["rail-adapters", "accord-402-flow", "audit-gated-mainnet"],
  "accord-mcp-paid-tools": ["paid-mcp-repo-audit-demo", "agent-work-agreements", "buyer-policy-agent-wallets"],
  "rail-adapters": ["provider-onboarding", "base-sepolia-contract-rail-live-evidence", "settlement-receipts"],
  "provider-onboarding": ["paid-mcp-tools-production-checklist", "rail-adapters", "launch-readiness-gates"],
  "launch-readiness-gates": ["provider-onboarding", "base-sepolia-contract-rail-live-evidence", "audit-gated-mainnet"],
  "why-ergo-reference-rail": ["rail-adapters", "audit-gated-mainnet", "settlement-receipts"],
  "conformance-levels": ["what-conformance-does-not-prove", "audit-gated-mainnet", "rail-adapters"],
  "audit-gated-mainnet": ["conformance-levels", "what-conformance-does-not-prove", "why-ergo-reference-rail"],
  "accord-vs-ap2": ["agent-work-agreements", "buyer-policy-agent-wallets", "verification-receipts"],
  "accord-vs-mcp": ["accord-mcp-paid-tools", "paid-mcp-repo-audit-demo", "agent-work-agreements"],
  "accord-402-flow": ["accord-vs-x402", "agreement-object-explained", "settlement-receipts"],
  "paid-mcp-repo-audit-demo": ["accord-mcp-paid-tools", "agent-work-agreements", "verification-receipts"],
  "agreement-object-explained": ["agent-work-agreements", "verification-receipts", "buyer-policy-agent-wallets"],
  "buyer-policy-agent-wallets": ["accord-vs-ap2", "agreement-object-explained", "audit-gated-mainnet"],
  "what-conformance-does-not-prove": ["conformance-levels", "audit-gated-mainnet", "security"]
};

const articleActions = {
  "base-sepolia-contract-rail-live-evidence": ["Open live pilot evidence", "Inspect the dated Base Sepolia result with receipts, explorer links and conformance output.", "https://github.com/accord-protocol/accord-protocol/blob/main/docs/pilots/results/2026-05-23-base-sepolia-contract-rail.md"],
  "agent-payments-stack": ["Start with the stack map", "Use the stack model before choosing a payment, authority or tool layer.", "/learn/agent-payments-stack/"],
  "payment-verification-vs-work-verification": ["Inspect the receipt schemas", "Separate payment proof, verification verdict and settlement evidence in your implementation.", "/schemas/verification-receipt.v0.schema.json"],
  "paid-mcp-tools-production-checklist": ["Run the paid MCP demo", "Exercise the lifecycle locally before adding a facilitator, testnet or real rail.", "https://github.com/accord-protocol/accord-protocol/tree/main/examples/15-paid-mcp-repo-audit"],
  "verifier-design-paid-agent-work": ["Open the Verification Receipt schema", "Design verifier output around a structured, signed verdict.", "/schemas/verification-receipt.v0.schema.json"],
  "agent-wallet-policy": ["Open the buyer policy package", "Review spend caps, allow-lists and signer wrapping before payment authority is granted.", "https://github.com/accord-protocol/accord-protocol/tree/main/packages/accord-buyer-policy"],
  "conformance-audit-mainnet-checklist": ["Check public status", "Keep production claims audit-gated and deny-by-default until signed evidence exists.", "/status/"],
  "agent-work-agreements": ["Read the Agreement spec", "Inspect the canonical Agreement Object fields.", "https://github.com/accord-protocol/accord-protocol/blob/main/specs/ACCORD-001-agreement-object.md"],
  "agreement-object-explained": ["Open the Agreement schema", "Use the schema as the source of truth for implementation shape.", "/schemas/agreement.v0.schema.json"],
  "verification-receipts": ["Open the Verification Receipt schema", "Check the accepted, rejected and partial acceptance record shape.", "/schemas/verification-receipt.v0.schema.json"],
  "settlement-receipts": ["Open the Settlement Receipt schema", "Inspect how rail evidence is recorded without custody claims.", "/schemas/settlement-receipt.v0.schema.json"],
  "accord-mcp-paid-tools": ["Run the paid MCP demo", "Start with the mock rail repository audit before any testnet work.", "https://github.com/accord-protocol/accord-protocol/tree/main/examples/15-paid-mcp-repo-audit"],
  "paid-mcp-repo-audit-demo": ["Open the demo source", "Run the full lifecycle locally with mock settlement.", "https://github.com/accord-protocol/accord-protocol/tree/main/examples/15-paid-mcp-repo-audit"],
  "accord-402-flow": ["Read the Accord/402 spec", "Map payment proof to agreement and receipt records.", "https://github.com/accord-protocol/accord-protocol/blob/main/specs/ACCORD-004-accord-402.md"],
  "accord-vs-x402": ["Read the Accord/402 flow", "See how x402 payment proof composes with Accord completion records.", "/learn/accord-402-flow/"],
  "accord-vs-mcp": ["Build a paid MCP tool", "Wrap a tool call with agreement, payment and verification semantics.", "/learn/accord-mcp-paid-tools/"],
  "accord-vs-ap2": ["Review buyer policy", "Connect payment authority to bounded work agreements and receipts.", "/learn/buyer-policy-agent-wallets/"],
  "rail-adapters": ["Open rail matrix", "Compare mock, Sage Ergo, Base Sepolia, x402 and Rosen by evidence, receipts, conformance and mainnet gate.", "https://github.com/accord-protocol/accord-protocol/blob/main/docs/RAIL_MATURITY_MATRIX.md"],
  "provider-onboarding": ["Open provider kit", "Copy .well-known/accord, receipt, registry profile, badge and PR templates for a new provider.", "https://github.com/accord-protocol/accord-protocol/tree/main/examples/17-provider-onboarding-kit"],
  "launch-readiness-gates": ["Open launch gates", "Check what must be polished before HN, Reddit, X, Discord or mcp.so distribution.", "https://github.com/accord-protocol/accord-protocol/blob/main/docs/LAUNCH_READINESS.md"],
  "why-ergo-reference-rail": ["Read the Ergo rail docs", "Review the first reference rail and its current limits.", "https://github.com/accord-protocol/accord-protocol/blob/main/docs/why-ergo.md"],
  "conformance-levels": ["Open the conformance package", "Use L0-L4 checks as compatibility evidence, not audit evidence.", "https://github.com/accord-protocol/accord-protocol/tree/main/packages/accord-conformance"],
  "audit-gated-mainnet": ["Check public status", "Confirm the current production gate before any real-fund workflow.", "/status/"],
  "buyer-policy-agent-wallets": ["Open buyer policy package", "Review spending caps and authority checks for agent wallets.", "https://github.com/accord-protocol/accord-protocol/tree/main/packages/accord-buyer-policy"],
  "what-conformance-does-not-prove": ["Read security posture", "Separate compatibility checks from production safety claims.", "/security/"]
};

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getArticle(slug) {
  return articles.find((article) => article.slug === slug);
}

function headingId(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function pageShell({ title, description, canonical, body, jsonLd, extraHead = "" }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    <link rel="canonical" href="${canonical}">
    <link rel="icon" type="image/svg+xml" href="/assets/logo.svg">
    <link rel="alternate" type="application/rss+xml" title="Accord Protocol Learn Feed" href="/feed.xml">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Accord Protocol">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${SITE_URL}/assets/og-card.png">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${SITE_URL}/assets/og-card.png">
${extraHead ? `    ${extraHead}\n` : ""}    <link rel="stylesheet" href="/styles.css">
    <script type="application/ld+json">${JSON.stringify(jsonLd, null, 6)}</script>
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header" data-header>
      <a class="brand" href="/" aria-label="Accord Protocol home">
        <img src="/assets/logo.svg" width="36" height="36" alt="">
        <span>Accord Protocol</span>
      </a>
      <nav id="primary-nav" class="site-nav" aria-label="Primary navigation" data-nav>
        <a href="/#why">Overview</a>
        <a href="/#protocol">Protocol</a>
        <a href="/#developers">Build</a>
        <a href="/learn/">Learn</a>
        <a href="/status/">Status</a>
        <a href="/security/">Security</a>
        <a href="/roadmap/">Roadmap</a>
        <a href="/#rails">Rails</a>
        <a href="/#agents">Agents</a>
      </nav>
      <a class="header-link" href="https://github.com/accord-protocol/accord-protocol" rel="noopener" target="_blank">GitHub</a>
      <button class="nav-toggle" type="button" aria-controls="primary-nav" aria-expanded="false" data-nav-toggle>
        <span>Menu</span>
        <span class="nav-toggle-lines" aria-hidden="true"></span>
      </button>
    </header>
    <main id="main">
${body}
    </main>
    <footer class="site-footer">
      <div class="footer-brand">
        <img src="/assets/logo.svg" width="34" height="34" alt="">
        <div>
          <strong>Accord Protocol</strong>
          <p>Open standard for autonomous agent work agreements.</p>
        </div>
      </div>
      <nav aria-label="Footer navigation">
        <a href="/learn/">Learn</a>
        <a href="/status/">Status</a>
        <a href="/security/">Security</a>
        <a href="/roadmap/">Roadmap</a>
        <a href="/llms.txt">llms.txt</a>
        <a href="/agents.txt">agents.txt</a>
        <a href="https://github.com/accord-protocol/accord-protocol" rel="noopener" target="_blank">GitHub</a>
        <a href="https://github.com/accord-protocol/accord-protocol/tree/main/specs" rel="noopener" target="_blank">Specs</a>
        <a href="/sitemap.xml">Sitemap</a>
      </nav>
    </footer>
    <script src="/script.js" defer></script>
  </body>
</html>
`;
}

function articleJsonLd(article) {
  const url = `${SITE_URL}/learn/${article.slug}/`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        "name": "Accord Protocol",
        "url": `${SITE_URL}/`,
        "logo": `${SITE_URL}/assets/logo.svg`
      },
      {
        "@type": "Article",
        "@id": `${url}#article`,
        "headline": article.title,
        "description": article.description,
        "datePublished": updated,
        "dateModified": updated,
        "author": {
          "@type": "Organization",
          "name": "Accord Protocol"
        },
        "publisher": {
          "@id": `${SITE_URL}/#organization`
        },
        "mainEntityOfPage": url,
        "image": `${SITE_URL}/assets/og-card.png`,
        "articleSection": article.eyebrow,
        ...(article.references ? {
          "citation": article.references.map((reference) => reference.url)
        } : {})
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumbs`,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": `${SITE_URL}/`
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Learn",
            "item": `${SITE_URL}/learn/`
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": article.title,
            "item": url
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        "mainEntity": article.faq.map(([question, answer]) => ({
          "@type": "Question",
          "name": question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": answer
          }
        }))
      }
    ]
  };
}

function renderArticle(article, index) {
  const canonical = `${SITE_URL}/learn/${article.slug}/`;
  const related = (relatedBySlug[article.slug] || articles
    .filter((item) => item.slug !== article.slug)
    .slice(index % 3, index % 3 + 3)
    .map((item) => item.slug))
    .map(getArticle)
    .filter(Boolean)
    .slice(0, 3);
  const action = articleActions[article.slug] || ["Read the overview spec", "Use the canonical v0 overview as the source of truth.", "https://github.com/accord-protocol/accord-protocol/blob/main/specs/ACCORD-000-overview.md"];
  const references = article.references || [];
  const sourcesTocLine = references.length ? "\n                <li><a href=\"#sources\">Sources</a></li>" : "";
  const referenceBlock = references.length
    ? `

            <section id="sources">
              <h2>Sources and references</h2>
              ${references.map((reference) => `<h3><a href="${reference.url}" rel="noopener" target="_blank">${reference.label}</a></h3>
              <p>${reference.note}</p>`).join("\n              ")}
            </section>`
    : "";

  const body = `      <article class="article-page">
        <header class="article-hero">
          <a class="breadcrumb" href="/learn/">Learn</a>
          <p class="eyebrow">${article.eyebrow}</p>
          <h1>${article.title}</h1>
          <p class="article-deck">${article.summary}</p>
          <div class="article-meta">
            <span>Updated ${updated}</span>
            <span>${article.readTime}</span>
            <span>Accord Protocol</span>
          </div>
        </header>

        <div class="article-layout">
          <aside class="article-aside" aria-label="Key takeaways">
            <h2>Key takeaways</h2>
            <ul>
              ${article.takeaways.map((item) => `<li>${item}</li>`).join("\n              ")}
            </ul>
            <nav class="article-toc" aria-label="Article sections">
              <h2>On this page</h2>
              <ol>
                ${article.sections.map((section) => `<li><a href="#${headingId(section.heading)}">${section.heading}</a></li>`).join("\n                ")}
                <li><a href="#faq">FAQ</a></li>${sourcesTocLine}
              </ol>
            </nav>
          </aside>

          <div class="article-content">
            ${article.sections.map((section) => `<section id="${headingId(section.heading)}">
              <h2>${section.heading}</h2>
              ${section.body.map((paragraph) => `<p>${paragraph}</p>`).join("\n              ")}
            </section>`).join("\n\n            ")}

            <section id="faq">
              <h2>FAQ</h2>
              ${article.faq.map(([question, answer]) => `<h3>${question}</h3>
              <p>${answer}</p>`).join("\n              ")}
            </section>${referenceBlock}

            <section class="article-action">
              <div>
                <span>Next action</span>
                <h2>${action[0]}</h2>
                <p>${action[1]}</p>
              </div>
              <a class="button button-primary" href="${action[2]}"${action[2].startsWith("http") ? ' rel="noopener" target="_blank"' : ""}>Open</a>
            </section>
          </div>
        </div>

        <section class="related-section" aria-label="Related articles">
          <div class="section-heading">
            <p class="eyebrow">Read next</p>
            <h2>Related Accord guides</h2>
          </div>
          <div class="learn-grid">
            ${related.map((item) => `<a class="learn-card" href="/learn/${item.slug}/">
              <span>${item.eyebrow}</span>
              <h3>${item.title}</h3>
              <p>${item.description}</p>
            </a>`).join("\n            ")}
          </div>
        </section>
      </article>`;

  return pageShell({
    title: `${article.title} | Accord Protocol`,
    description: article.description,
    canonical,
    jsonLd: articleJsonLd(article),
    body
  });
}

function learnIndexJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${SITE_URL}/learn/#collection`,
        "name": "Accord Protocol Learn",
        "url": `${SITE_URL}/learn/`,
        "description": "Guides to Accord Protocol, agent work agreements, verification receipts, settlement receipts, rail adapters and conformance.",
        "hasPart": articles.map((article) => ({
          "@type": "Article",
          "headline": article.title,
          "url": `${SITE_URL}/learn/${article.slug}/`,
          "description": article.description
        }))
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${SITE_URL}/learn/#breadcrumbs`,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": `${SITE_URL}/`
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Learn",
            "item": `${SITE_URL}/learn/`
          }
        ]
      }
    ]
  };
}

function renderLearnIndex() {
  const body = `      <section class="learn-hero">
        <p class="eyebrow">Accord Learn</p>
        <h1>Guides for agent work agreements.</h1>
        <p>Evergreen explainers for developers, researchers and agents learning how Accord records terms, verification and settlement.</p>
        <div class="learn-path-summary" aria-label="Recommended learning paths">
          ${learnGroups.map((group) => `<a href="#${headingId(group.label)}">
            <span>${group.label}</span>
            <strong>${group.slugs.length} guides</strong>
          </a>`).join("\n          ")}
        </div>
      </section>

      <section class="learn-index">
        ${learnGroups.map((group) => `<section class="learn-group" id="${headingId(group.label)}">
          <div class="learn-group-heading">
            <div>
              <p class="eyebrow">${group.label}</p>
              <h2>${group.description}</h2>
            </div>
          </div>
          <div class="learn-grid">
            ${group.slugs.map(getArticle).filter(Boolean).map((article) => `<a class="learn-card" href="/learn/${article.slug}/">
              <span>${article.eyebrow}</span>
              <h3>${article.title}</h3>
              <p>${article.description}</p>
              <small>${article.readTime}</small>
            </a>`).join("\n            ")}
          </div>
        </section>`).join("\n\n        ")}
      </section>`;

  return pageShell({
    title: "Learn Accord Protocol | Guides for Agent Work Agreements",
    description: "Guides to Accord Protocol, x402, MCP paid tools, verification receipts, settlement receipts, rail adapters and audit-gated mainnet policy.",
    canonical: `${SITE_URL}/learn/`,
    jsonLd: learnIndexJsonLd(),
    body
  });
}

function staticPageJsonLd(page) {
  const url = `${SITE_URL}/${page.slug}/`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        "name": page.title,
        "url": url,
        "description": page.description,
        "dateModified": updated,
        "publisher": {
          "@type": "Organization",
          "name": "Accord Protocol",
          "url": `${SITE_URL}/`
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumbs`,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": `${SITE_URL}/`
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": page.title,
            "item": url
          }
        ]
      }
    ]
  };
}

function renderTrustEvidence(page) {
  if (page.slug === "status") {
    return `<section class="trust-evidence">
              <p class="eyebrow">Operational evidence</p>
              <h2>Readiness matrix</h2>
              <div class="readiness-table" role="table" aria-label="Accord readiness matrix">
                <div class="readiness-row readiness-head" role="row">
                  <span role="columnheader">Surface</span>
                  <span role="columnheader">Allowed today</span>
                  <span role="columnheader">Gate</span>
                  <span role="columnheader">Evidence</span>
                </div>
                <div class="readiness-row" role="row">
                  <span role="cell">Mock rail demos</span>
                  <span role="cell">Yes</span>
                  <span role="cell">Local development only</span>
                  <a role="cell" href="https://github.com/accord-protocol/accord-protocol/tree/main/examples/15-paid-mcp-repo-audit" rel="noopener" target="_blank">Paid MCP repo audit</a>
                </div>
                <div class="readiness-row" role="row">
                  <span role="cell">Conformance</span>
                  <span role="cell">Yes</span>
                  <span role="cell">Compatibility, not audit</span>
                  <a role="cell" href="https://github.com/accord-protocol/accord-protocol/tree/main/packages/accord-conformance" rel="noopener" target="_blank">Conformance package</a>
                </div>
                <div class="readiness-row" role="row">
                  <span role="cell">Reference rails</span>
                  <span role="cell">Testnet only</span>
                  <span role="cell">Rail-specific review</span>
                  <a role="cell" href="https://github.com/accord-protocol/accord-protocol/tree/main/registry/rails" rel="noopener" target="_blank">Rail registry</a>
                </div>
                <div class="readiness-row" role="row">
                  <span role="cell">P4 pilots</span>
                  <span role="cell">Complete for current matrix</span>
                  <span role="cell">External evidence, not mainnet certification</span>
                  <a role="cell" href="https://github.com/accord-protocol/accord-protocol/tree/main/docs/pilots/results" rel="noopener" target="_blank">Pilot results</a>
                </div>
                <div class="readiness-row" role="row">
                  <span role="cell">Mainnet production</span>
                  <span role="cell">No</span>
                  <span role="cell">Signed audit manifests</span>
                  <a role="cell" href="https://github.com/accord-protocol/accord-protocol/tree/main/docs/audit" rel="noopener" target="_blank">Audit docs</a>
                </div>
              </div>
            </section>`;
  }

  if (page.slug === "security") {
    return `<section class="trust-evidence">
              <p class="eyebrow">Security operations</p>
              <h2>Boundaries that must stay explicit</h2>
              <div class="boundary-grid">
                <article>
                  <span>Report</span>
                  <h3>Private vulnerability path</h3>
                  <p>Use GitHub private vulnerability reporting or the process in SECURITY.md for exploitable issues.</p>
                  <a href="https://github.com/accord-protocol/accord-protocol/blob/main/SECURITY.md" rel="noopener" target="_blank">Read SECURITY.md</a>
                </article>
                <article>
                  <span>Scope</span>
                  <h3>Protocol and reference code</h3>
                  <p>Schema handling, SDK behavior, rail adapters, signer assumptions and replay protection are in scope.</p>
                  <a href="https://github.com/accord-protocol/accord-protocol/tree/main/packages" rel="noopener" target="_blank">Browse packages</a>
                </article>
                <article>
                  <span>Gate</span>
                  <h3>Audit manifests</h3>
                  <p>Mainnet permission depends on signed manifests, not broad compatibility or marketing claims.</p>
                  <a href="https://github.com/accord-protocol/accord-protocol/tree/main/docs/audit" rel="noopener" target="_blank">Audit evidence</a>
                </article>
                <article>
                  <span>Boundary</span>
                  <h3>Verifier and rail risk</h3>
                  <p>Verifier quality, bridge behavior, facilitator proof and wallet policy remain external trust assumptions.</p>
                  <a href="/learn/what-conformance-does-not-prove/">Conformance limits</a>
                </article>
              </div>
            </section>`;
  }

  return `<section class="trust-evidence">
            <p class="eyebrow">Roadmap phases</p>
            <h2>Conservative path to production credibility</h2>
            <div class="timeline">
              <article>
                <span>Now</span>
                <h3>Package the evidence release</h3>
                <p>Keep specs, schemas, examples, conformance, P4 result records and public status aligned for v0.4.2.</p>
              </article>
              <article>
                <span>Next</span>
                <h3>Make the golden path obvious</h3>
                <p>Make mock rail, Accord/MCP, Accord/402, conformance and Base Sepolia evidence easy to run or inspect in order.</p>
              </article>
              <article>
                <span>Audit-gated</span>
                <h3>Rail-specific review</h3>
                <p>Publish signed evidence before any mainnet permission is represented as safe.</p>
              </article>
              <article>
                <span>Later</span>
                <h3>Broader implementations</h3>
                <p>Support more independent adapters and conformance-backed integrations.</p>
              </article>
            </div>
          </section>`;
}

function renderStaticPage(page) {
  const body = `      <article class="article-page">
        <header class="article-hero">
          <a class="breadcrumb" href="/">Home</a>
          <p class="eyebrow">${page.eyebrow}</p>
          <h1>${page.title}</h1>
          <p class="article-deck">${page.summary}</p>
          <div class="article-meta">
            <span>Updated ${updated}</span>
            <span>Accord Protocol</span>
          </div>
        </header>

        <div class="article-layout">
          <aside class="article-aside" aria-label="Page summary">
            <h2>Summary</h2>
            <ul>
              ${page.sections.map((section) => `<li>${section.heading}</li>`).join("\n              ")}
            </ul>
          </aside>

          <div class="article-content">
            ${page.sections.map((section) => `<section>
              <h2>${section.heading}</h2>
              ${section.body.map((paragraph) => `<p>${paragraph}</p>`).join("\n              ")}
            </section>`).join("\n\n            ")}

            ${renderTrustEvidence(page)}
          </div>
        </div>
      </article>`;

  return pageShell({
    title: `${page.title} | Accord Protocol`,
    description: page.description,
    canonical: `${SITE_URL}/${page.slug}/`,
    jsonLd: staticPageJsonLd(page),
    body
  });
}

function renderSitemap() {
  const urls = [
    ["", "1.0"],
    ["learn/", "0.9"],
    ...staticPages.map((page) => [`${page.slug}/`, "0.8"]),
    ["llms.txt", "0.7"],
    ["llms-full.txt", "0.7"],
    ["agents.txt", "0.6"],
    [".well-known/accord.json", "0.6"],
    ...articles.map((article) => [`learn/${article.slug}/`, "0.8"])
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([path, priority]) => `  <url>
    <loc>${SITE_URL}/${path}</loc>
    <lastmod>${updated}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`).join("\n")}
</urlset>
`;
}

function renderFeed() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Accord Protocol Learn</title>
    <link>${SITE_URL}/learn/</link>
    <description>Guides to agent work agreements, verification receipts, settlement receipts and Accord Protocol architecture.</description>
    <language>en</language>
    <lastBuildDate>${new Date(`${updated}T00:00:00Z`).toUTCString()}</lastBuildDate>
${articles.map((article) => `    <item>
      <title>${escapeHtml(article.title)}</title>
      <link>${SITE_URL}/learn/${article.slug}/</link>
      <guid>${SITE_URL}/learn/${article.slug}/</guid>
      <pubDate>${new Date(`${updated}T00:00:00Z`).toUTCString()}</pubDate>
      <description>${escapeHtml(article.description)}</description>
    </item>`).join("\n")}
  </channel>
</rss>
`;
}

function writeBoth(path, content) {
  for (const root of [".", "site"]) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}

writeBoth("learn/index.html", renderLearnIndex());

articles.forEach((article, index) => {
  writeBoth(`learn/${article.slug}/index.html`, renderArticle(article, index));
});

staticPages.forEach((page) => {
  writeBoth(`${page.slug}/index.html`, renderStaticPage(page));
});

writeBoth("sitemap.xml", renderSitemap());
writeBoth("feed.xml", renderFeed());

console.log(`Generated ${articles.length} learn articles, ${staticPages.length} trust pages, sitemap.xml and feed.xml.`);
