import type { z } from "zod";
import type { aiSimPayload, ModuleFixture } from "@/modules/curriculum/schemas";

import { hints, t } from "./kit";

/**
 * Three AI lessons from the handoff's curriculum backlog, all on the
 * "mark the items" widget (src/modules/ai/lab/players/MarkItems.tsx):
 *
 *  - Two Answers    (generative AI) — two chatbots answer the same question;
 *    check each sentence against the notice, and find what they invented.
 *  - Need to Know   (AI and privacy) — a message to a homework helper;
 *    strike out every detail the task doesn't need.
 *  - Say It Clearly (natural language, grades 5-7) — make a vague
 *    instruction to an assistant say exactly which, where, who and when.
 *
 * Everything here is fictional and safe: no real chatbot, no real person.
 */

type AiSimDraft = z.input<typeof aiSimPayload>;
type LevelDraft = ModuleFixture["levels"][number];

const L = (en: string, ar: string) => ({ en, ar });

// ── Two Answers (generative AI) ───────────────────────────────────────────
export const twoAnswers: LevelDraft = {
  slug: "two-answers",
  order: 4,
  activityType: "AI_SIM",
  track: "AI_CONCEPTS",
  title: t("Two Answers", "إجابتان"),
  story: t(
    "Robo Bunny asked two chatbots the same question about Lakeview Library. Both answered at once, both sounded sure — and they don't agree.",
    "سأل الأرنب الآلي روبوتي دردشة السؤال نفسه عن مكتبة ليكفيو. أجاب كلاهما فورًا، وبدا كلاهما واثقًا — لكنهما لا يتفقان.",
  ),
  objective: t(
    "Recognise that a text-generating AI can invent plausible details, and verify each claim against a trusted source instead of trusting fluency.",
    "إدراك أن الذكاء الاصطناعي الذي يولّد النصوص قد يخترع تفاصيل معقولة، والتحقق من كل ادعاء مقابل مصدر موثوق بدلًا من الثقة بالطلاقة.",
  ),
  mission: t(
    "Check every sentence against the library's notice. Which details did the chatbots make up?",
    "تحقّق من كل جملة مقابل إعلان المكتبة. ما التفاصيل التي اخترعها روبوتا الدردشة؟",
  ),
  instructions: t(
    "First, say which answer you trust more. Then read the library's own notice, and mark every sentence: does the notice say so, or not? Press “Check my work” when every sentence is marked.",
    "أولًا، قل أي إجابة تثق بها أكثر. ثم اقرأ إعلان المكتبة نفسه، وضع علامة على كل جملة: هل يقول الإعلان ذلك، أم لا؟ اضغط «تحقّق من عملي» عندما تضع علامة على كل جملة.",
  ),
  explanation: t(
    "Both chatbots wrote smooth, confident sentences, and both mixed true details with made-up ones. That's how a text-generating AI works: it predicts words that sound right, and it has no idea whether they are. The fix isn't to stop using it; it's to check the details that matter against a source you trust — here, the library's own notice. The one that sounded most sure wasn't the one that was most right.",
    "كتب روبوتا الدردشة جملًا سلسة وواثقة، وخلط كلاهما تفاصيل صحيحة بأخرى مخترعة. هكذا يعمل الذكاء الاصطناعي الذي يولّد النصوص: يتوقّع كلمات تبدو صحيحة، ولا يعرف إن كانت كذلك. والحل ليس التوقف عن استخدامه، بل التحقق من التفاصيل المهمة مقابل مصدر تثق به — وهنا، إعلان المكتبة نفسه. لم يكن الأكثر ثقة هو الأكثر صوابًا.",
  ),
  keyIdea: t(
    "A chatbot can sound sure and still invent details, so check them against a source you trust.",
    "قد يبدو روبوت الدردشة واثقًا ومع ذلك يخترع تفاصيل، لذا تحقّق منها مقابل مصدر تثق به.",
  ),
  teacherNotes: t(
    "Both answers are written for this lesson — no model is called. Pip's cafe sentence is the interesting one: it may even be true, but the notice doesn't say so, so it can't be trusted yet. Discuss the difference between 'false' and 'not supported by the source'. Good question: which chatbot did the class trust before checking, and why?",
    "كُتبت الإجابتان لهذا الدرس — لا يُستدعى أي نموذج. جملة المقهى في إجابة «بيب» هي الأهم: قد تكون صحيحة، لكن الإعلان لا يقولها، لذا لا يمكن الوثوق بها بعد. ناقشوا الفرق بين «خاطئ» و«غير مدعوم بالمصدر». سؤال جيد: بأي روبوت وثق الصف قبل التحقق، ولماذا؟",
  ),
  difficulty: "MEDIUM",
  recommendedGradeMin: 4,
  recommendedGradeMax: 7,
  estimatedMinutes: 8,
  xpReward: 60,
  tags: ["ai", "generative-ai", "misinformation"],
  requires: [],
  hints: hints(
    ["Read the notice first. It is the only thing here you know is true.", "اقرأ الإعلان أولًا. إنه الشيء الوحيد هنا الذي تعرف أنه صحيح."],
    ["Take one sentence at a time and find the line in the notice it talks about.", "خذ جملة واحدة في كل مرة وابحث عن السطر الذي تتحدث عنه في الإعلان."],
    ["If the notice doesn't mention something at all, it doesn't say so — even if it sounds nice.", "إذا لم يذكر الإعلان شيئًا أبدًا، فهو لا يقول ذلك — حتى لو بدا لطيفًا."],
    ["Look closely at the days and the numbers. That's where chatbots slip.", "انظر بدقة إلى الأيام والأرقام. هناك تخطئ روبوتات الدردشة."],
  ),
  payload: {
    widget: {
      widgetId: "mark-items",
      layout: "sentences",
      predict: {
        question: L("Before you check: which answer do you trust more?", "قبل أن تتحقّق: بأي إجابة تثق أكثر؟"),
        options: [
          { id: "sunny", text: L("Sunny's", "إجابة «صني»") },
          { id: "pip", text: L("Pip's", "إجابة «بيب»") },
          { id: "unsure", text: L("Can't tell yet", "لا أستطيع أن أعرف بعد") },
        ],
      },
      source: {
        title: L("Lakeview Library — notice on the door", "مكتبة ليكفيو — إعلان على الباب"),
        lines: [
          L("Open Monday to Thursday, 9 am to 5 pm.", "مفتوحة من الاثنين إلى الخميس، من 9 صباحًا إلى 5 مساءً."),
          L("Friday: open 9 am to 1 pm.", "الجمعة: مفتوحة من 9 صباحًا إلى 1 ظهرًا."),
          L("Closed on Saturday and Sunday.", "مغلقة يومي السبت والأحد."),
          L("Children can borrow up to 5 books for 2 weeks.", "يستطيع الأطفال استعارة 5 كتب على الأكثر لمدة أسبوعين."),
        ],
      },
      marks: [
        { id: "says", text: L("The notice says so", "الإعلان يقول ذلك"), icon: "✅" },
        { id: "not", text: L("The notice doesn't say so", "الإعلان لا يقول ذلك"), icon: "❓" },
      ],
      groups: [
        {
          id: "sunny",
          title: L("Chatbot Sunny", "روبوت الدردشة «صني»"),
          items: [
            { id: "a1", text: L("The library opens at 9 am from Monday to Thursday.", "تفتح المكتبة الساعة 9 صباحًا من الاثنين إلى الخميس."), answer: "says" },
            { id: "a2", text: L("On those days it closes at 5 pm.", "وتغلق في تلك الأيام الساعة 5 مساءً."), answer: "says" },
            { id: "a3", text: L("On Saturday it's open until noon.", "ويوم السبت تكون مفتوحة حتى الظهر."), answer: "not" },
            { id: "a4", text: L("Children can borrow up to 5 books.", "يستطيع الأطفال استعارة 5 كتب على الأكثر."), answer: "says" },
          ],
        },
        {
          id: "pip",
          title: L("Chatbot Pip", "روبوت الدردشة «بيب»"),
          items: [
            { id: "b1", text: L("The library is open every day of the week.", "المكتبة مفتوحة كل أيام الأسبوع."), answer: "not" },
            { id: "b2", text: L("On Friday it closes at 1 pm.", "يوم الجمعة تغلق الساعة 1 ظهرًا."), answer: "says" },
            { id: "b3", text: L("Children can borrow 10 books for a month.", "يستطيع الأطفال استعارة 10 كتب لمدة شهر."), answer: "not" },
            { id: "b4", text: L("There's a free cafe on the top floor.", "يوجد مقهى مجاني في الطابق العلوي."), answer: "not" },
          ],
        },
      ],
      tryNext: L(
        "Next time a chatbot answers you, pick one detail that matters and check it somewhere you trust.",
        "في المرة القادمة التي يجيبك فيها روبوت دردشة، اختر تفصيلًا واحدًا مهمًا وتحقّق منه في مكان تثق به.",
      ),
    },
    intro: L(
      "Two chatbots answered the same question. Check every sentence against the library's own notice.",
      "أجاب روبوتا دردشة عن السؤال نفسه. تحقّق من كل جملة مقابل إعلان المكتبة نفسه.",
    ),
    honesty: {
      kind: "SIMULATED",
      note: L(
        "Simulated: both answers were written for this lesson to show how chatbots can invent details. No real chatbot is used.",
        "محاكاة: كُتبت الإجابتان لهذا الدرس لتُظهرا كيف تخترع روبوتات الدردشة التفاصيل. لا يُستخدم أي روبوت دردشة حقيقي.",
      ),
    },
  } satisfies AiSimDraft,
};

// ── Need to Know (AI and privacy) ─────────────────────────────────────────
export const needToKnow: LevelDraft = {
  slug: "need-to-know",
  order: 5,
  activityType: "AI_SIM",
  track: "AI_CONCEPTS",
  title: t("Need to Know", "ما يلزم فقط"),
  story: t(
    "Maya wants an AI homework helper to find her a book. She's written a message — and put a lot more about herself in it than the helper needs.",
    "تريد مايا من مساعد واجبات ذكي أن يجد لها كتابًا. كتبت رسالة — ووضعت فيها عن نفسها أكثر بكثير مما يحتاجه المساعد.",
  ),
  objective: t(
    "Decide what information an AI helper needs for a task, and remove personal details it doesn't (data minimisation).",
    "تحديد المعلومات التي يحتاجها المساعد الذكي لمهمة ما، وحذف التفاصيل الشخصية التي لا يحتاجها (تقليل البيانات).",
  ),
  mission: t("Strike out everything the helper doesn't need to know.", "احذف كل ما لا يحتاج المساعد إلى معرفته."),
  instructions: t(
    "Read what the helper has to do. Then tap each detail in Maya's message that the helper doesn't need, to strike it out. Tap again to keep it. Press “Check my work” when the message is ready to send.",
    "اقرأ ما يجب أن يفعله المساعد. ثم اضغط على كل تفصيل في رسالة مايا لا يحتاجه المساعد لتحذفه. اضغط مرة أخرى لتبقيه. اضغط «تحقّق من عملي» عندما تصبح الرسالة جاهزة للإرسال.",
  ),
  explanation: t(
    "To find a book about sharks for a Grade 4 project, the helper needs three things: sharks, Grade 4 and 'school project'. Maya's full name, her school, her street and her phone number don't help it find a book at all — they only tell a machine, and whoever runs it, who and where she is. Small details add up. Asking 'does it need this to do the job?' before you send is one of the simplest, strongest privacy habits there is.",
    "لإيجاد كتاب عن أسماك القرش لمشروع الصف الرابع، يحتاج المساعد إلى ثلاثة أشياء: أسماك القرش، والصف الرابع، و«مشروع مدرسي». اسم مايا الكامل ومدرستها وشارعها ورقم هاتفها لا تساعده في إيجاد كتاب أبدًا — بل تخبر الآلة، ومن يشغّلها، من هي وأين هي. التفاصيل الصغيرة تتراكم. سؤال «هل يحتاج هذا ليقوم بعمله؟» قبل الإرسال من أبسط عادات الخصوصية وأقواها.",
  ),
  keyIdea: t(
    "Give a helper only what the task needs; everything else about you stays yours.",
    "أعطِ المساعد ما تحتاجه المهمة فقط؛ وكل ما عدا ذلك عنك يبقى لك.",
  ),
  teacherNotes: t(
    "The helper is pretend and nothing is sent anywhere. 'Grade 4' is kept because the task needs a book at the right level — a good discussion point: some details are personal but still needed. Ask: what would change if the task were 'send my project to my teacher'?",
    "المساعد متخيَّل ولا يُرسل شيء إلى أي مكان. يبقى «الصف الرابع» لأن المهمة تحتاج كتابًا بالمستوى المناسب — نقطة جيدة للنقاش: بعض التفاصيل شخصية لكنها لازمة. اسألوا: ما الذي سيتغيّر لو كانت المهمة «أرسل مشروعي إلى معلمتي»؟",
  ),
  difficulty: "EASY",
  recommendedGradeMin: 3,
  recommendedGradeMax: 7,
  estimatedMinutes: 5,
  xpReward: 45,
  tags: ["ai", "privacy"],
  requires: [],
  hints: hints(
    ["Read the task first: what does the helper actually have to do?", "اقرأ المهمة أولًا: ماذا يجب على المساعد أن يفعل فعلًا؟"],
    ["For each detail, ask: would the helper find a worse book without it?", "لكل تفصيل، اسأل: هل سيجد المساعد كتابًا أسوأ من دونه؟"],
    ["Names, schools, addresses and phone numbers say who and where you are — a book search doesn't need them.", "الأسماء والمدارس والعناوين وأرقام الهواتف تقول من أنت وأين أنت — والبحث عن كتاب لا يحتاجها."],
    ["Keep the topic, the grade and the kind of work. Strike out the rest.", "أبقِ الموضوع والصف ونوع العمل. واحذف الباقي."],
  ),
  payload: {
    widget: {
      widgetId: "mark-items",
      layout: "tokens",
      source: {
        title: L("What the helper has to do", "ما يجب أن يفعله المساعد"),
        lines: [L("Find a library book about sharks for a Grade 4 school project.", "إيجاد كتاب من المكتبة عن أسماك القرش لمشروع مدرسي للصف الرابع.")],
      },
      marks: [
        { id: "keep", text: L("Keep", "أبقِه") },
        { id: "strike", text: L("Strike out", "احذفه") },
      ],
      defaultMark: "keep",
      groups: [
        {
          id: "message",
          title: L("Maya's message to the helper", "رسالة مايا إلى المساعد"),
          items: [
            { id: "t1", text: L("Hi! My name is ", "مرحبًا! اسمي ") },
            { id: "t2", text: L("Maya Haddad", "مايا حداد"), answer: "strike" },
            { id: "t3", text: L(", I'm in ", "، أنا في ") },
            { id: "t4", text: L("Grade 4", "الصف الرابع"), answer: "keep" },
            { id: "t5", text: L(" at ", " في ") },
            { id: "t6", text: L("Al Noor School", "مدرسة النور"), answer: "strike" },
            { id: "t7", text: L(", and I live at ", "، وأسكن في ") },
            { id: "t8", text: L("12 Palm Street", "12 شارع النخيل"), answer: "strike" },
            { id: "t9", text: L(". My phone number is ", ". رقم هاتفي ") },
            { id: "t10", text: L("055 123 4567", "055 123 4567"), answer: "strike" },
            { id: "t11", text: L(". Please find me a library book about ", ". من فضلك جد لي كتابًا من المكتبة عن ") },
            { id: "t12", text: L("sharks", "أسماك القرش"), answer: "keep" },
            { id: "t13", text: L(" for my ", " من أجل ") },
            { id: "t14", text: L("school project", "مشروعي المدرسي"), answer: "keep" },
            { id: "t15", text: L(".", ".") },
          ],
        },
      ],
      tryNext: L(
        "Next time an app or chatbot asks you for something, ask: does it need this to do the job?",
        "في المرة القادمة التي يطلب فيها منك تطبيق أو روبوت دردشة شيئًا، اسأل: هل يحتاج هذا ليقوم بعمله؟",
      ),
    },
    intro: L(
      "A homework helper only needs what the task needs. Strike out the rest before Maya sends her message.",
      "لا يحتاج مساعد الواجبات إلا ما تحتاجه المهمة. احذف الباقي قبل أن ترسل مايا رسالتها.",
    ),
    honesty: {
      kind: "SIMULATED",
      note: L("Simulated: the helper is pretend, and Maya's message isn't sent anywhere.", "محاكاة: المساعد متخيَّل، ورسالة مايا لا تُرسل إلى أي مكان."),
    },
  } satisfies AiSimDraft,
};

// ── Say It Clearly (natural language, grades 5-7) ─────────────────────────
export const sayItClearly: LevelDraft = {
  slug: "say-it-clearly",
  order: 3,
  activityType: "AI_SIM",
  track: "MACHINE_LEARNING",
  title: t("Say It Clearly", "قُلها بوضوح"),
  story: t(
    "Robo Helper is setting up the classroom for the science fair. Your instruction made perfect sense to you. To Robo Helper, it could mean a dozen different things.",
    "يجهّز المساعد الآلي الصف لمعرض العلوم. كانت تعليماتك واضحة تمامًا بالنسبة لك. أما بالنسبة للمساعد الآلي، فقد تعني عشرات الأشياء المختلفة.",
  ),
  objective: t(
    "Identify ambiguous words in a natural-language instruction to an AI assistant and revise them into precise references (which, where, who, when).",
    "تحديد الكلمات الغامضة في تعليمات بلغة طبيعية لمساعد ذكي وتعديلها إلى إشارات دقيقة (أيّ، أين، من، متى).",
  ),
  mission: t("Make every vague word say exactly what you mean.", "اجعل كل كلمة غامضة تقول بالضبط ما تعنيه."),
  instructions: t(
    "First, say whether Robo Helper will know exactly what to do. Then, for each highlighted vague word, choose the wording that says exactly which, where, who or when. Watch what Robo Helper hears change. Press “Check my work” when it's clear.",
    "أولًا، قل هل سيعرف المساعد الآلي بالضبط ما يفعل. ثم، لكل كلمة غامضة مظلّلة، اختر الصياغة التي تقول بالضبط أيّ، أو أين، أو من، أو متى. شاهد ما يسمعه المساعد الآلي يتغيّر. اضغط «تحقّق من عملي» عندما تصبح واضحة.",
  ),
  explanation: t(
    "People fill gaps with what they already know: you knew which table was 'the big one'. An AI assistant has only your words, so 'it', 'them' and 'soon' force it to guess, and a confident guess can be wrong. Clear instructions name the thing, the place, the people and the time. That isn't just good manners with machines: it's how you get the result you actually wanted.",
    "يملأ الناس الفراغات بما يعرفونه مسبقًا: كنت تعرف أي طاولة هي «الكبيرة». أما المساعد الذكي فليس لديه إلا كلماتك، لذا فإن «هو» و«هم» و«قريبًا» تجبره على التخمين، والتخمين الواثق قد يكون خاطئًا. التعليمات الواضحة تسمّي الشيء والمكان والأشخاص والوقت. هذا ليس مجرد أدب مع الآلات: إنه الطريقة التي تحصل بها على النتيجة التي أردتها فعلًا.",
  ),
  keyIdea: t(
    "An assistant can only do what your words say, so say exactly which, where, who and when.",
    "لا يستطيع المساعد أن يفعل إلا ما تقوله كلماتك، لذا قل بالضبط أيّ، وأين، ومن، ومتى.",
  ),
  teacherNotes: t(
    "Robo Helper is pretend; nothing is sent to a model. The level is about ambiguity (referents, deixis, vague time words), the heart of natural-language interaction. Extension: have pairs write an instruction for each other and find every word a stranger couldn't act on.",
    "المساعد الآلي متخيَّل؛ لا يُرسل شيء إلى أي نموذج. يدور المستوى حول الغموض (المرجع، وكلمات الإشارة، وكلمات الوقت الغامضة)، وهو جوهر التفاعل باللغة الطبيعية. نشاط إضافي: يكتب كل زوج تعليمات للآخر ويبحث عن كل كلمة لا يستطيع شخص غريب أن يعمل بها.",
  ),
  difficulty: "MEDIUM",
  recommendedGradeMin: 5,
  recommendedGradeMax: 7,
  estimatedMinutes: 6,
  xpReward: 55,
  tags: ["ai", "natural-language"],
  requires: [],
  hints: hints(
    ["Read the instruction as if you were a robot who has never seen the classroom.", "اقرأ التعليمات كأنك روبوت لم يرَ الصف من قبل."],
    ["For each highlighted word, ask: could this mean more than one thing?", "لكل كلمة مظلّلة، اسأل: هل يمكن أن تعني أكثر من شيء؟"],
    ["The clear choice names exactly one thing, place, group of people or time.", "الاختيار الواضح يسمّي شيئًا واحدًا بالضبط، أو مكانًا، أو مجموعة أشخاص، أو وقتًا."],
    ["'Soon' and 'them' are never clear to a machine. Pick the choice with a real time and real names.", "«قريبًا» و«هم» ليستا واضحتين أبدًا لآلة. اختر ما فيه وقت حقيقي وأسماء حقيقية."],
  ),
  payload: {
    widget: {
      widgetId: "mark-items",
      layout: "choices",
      predict: {
        question: L("Will Robo Helper know exactly what to do?", "هل سيعرف المساعد الآلي بالضبط ما يفعل؟"),
        options: [
          { id: "yes", text: L("Yes", "نعم") },
          { id: "no", text: L("No, it's too vague", "لا، إنها غامضة جدًّا") },
          { id: "unsure", text: L("Not sure", "لست متأكدًا") },
        ],
      },
      groups: [
        {
          id: "instruction",
          title: L("Your instruction to Robo Helper", "تعليماتك للمساعد الآلي"),
          items: [
            { id: "p1", text: L("Put ", "ضع ") },
            {
              id: "v1",
              text: L("the big one", "الكبيرة"),
              options: [
                { id: "v1-clear", text: L("the big blue table", "الطاولة الزرقاء الكبيرة") },
                { id: "v1-vague", text: L("the big one", "الكبيرة") },
                { id: "v1-other", text: L("something big", "شيئًا كبيرًا") },
              ],
              answer: "v1-clear",
            },
            { id: "p2", text: L(" next to ", " بجانب ") },
            {
              id: "v2",
              text: L("it", "ذلك"),
              options: [
                { id: "v2-vague", text: L("it", "ذلك") },
                { id: "v2-clear", text: L("the window", "النافذة") },
                { id: "v2-other", text: L("over there", "هناك") },
              ],
              answer: "v2-clear",
            },
            { id: "p3", text: L(", and email the plan to ", "، وأرسل الخطة بالبريد إلى ") },
            {
              id: "v3",
              text: L("them", "هم"),
              options: [
                { id: "v3-other", text: L("everyone who might want it", "كل من قد يريدها") },
                { id: "v3-vague", text: L("them", "هم") },
                { id: "v3-clear", text: L("Ms Sara and the Grade 6 class", "الأستاذة سارة وطلاب الصف السادس") },
              ],
              answer: "v3-clear",
            },
            { id: "p4", text: L(" ", " ") },
            {
              id: "v4",
              text: L("soon", "قريبًا"),
              options: [
                { id: "v4-clear", text: L("by 3 pm on Thursday", "قبل الساعة 3 مساءً يوم الخميس") },
                { id: "v4-other", text: L("when you can", "عندما تستطيع") },
                { id: "v4-vague", text: L("soon", "قريبًا") },
              ],
              answer: "v4-clear",
            },
            { id: "p5", text: L(".", ".") },
          ],
        },
      ],
      tryNext: L(
        "Next time you ask an assistant for something, reread it: could 'it', 'them' or 'soon' mean more than one thing?",
        "في المرة القادمة التي تطلب فيها شيئًا من مساعد، أعد قراءته: هل يمكن أن تعني «ذلك» أو «هم» أو «قريبًا» أكثر من شيء؟",
      ),
    },
    intro: L(
      "Robo Helper has only your words. Make every vague one say exactly what you mean.",
      "ليس لدى المساعد الآلي إلا كلماتك. اجعل كل كلمة غامضة تقول بالضبط ما تعنيه.",
    ),
    honesty: {
      kind: "SIMULATED",
      note: L(
        "Simulated: Robo Helper is pretend, and what it hears is worked out from your choices on this page. Real assistants guess what vague words mean — sometimes wrongly.",
        "محاكاة: المساعد الآلي متخيَّل، وما يسمعه يُحسب من اختياراتك في هذه الصفحة. المساعدون الحقيقيون يخمّنون معنى الكلمات الغامضة — وأحيانًا يخطئون.",
      ),
    },
  } satisfies AiSimDraft,
};
