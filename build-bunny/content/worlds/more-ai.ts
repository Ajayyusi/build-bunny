import type { z } from "zod";
import type {
  ModuleFixture,
  aiClassificationPayload,
  aiEthicsPayload,
  patternRecognitionPayload,
} from "@/modules/curriculum/schemas";

import { hints, t } from "./kit";

/**
 * More AI-world levels (curriculum toward 100): online safety and kindness
 * on AI Island, more grouping and teaching on Data Desert, and two ML Lab
 * levels on who should decide and how few examples a machine can learn
 * from. Classification levels are solved by the playthrough's own search
 * (no recorded answer), and grouping levels' reference flags are proven to
 * clear their bar in tests/unit/expansion-content.test.ts.
 */

type AiEthicsDraft = z.input<typeof aiEthicsPayload>;
type AiClassificationDraft = z.input<typeof aiClassificationPayload>;
type PrDraft = z.input<typeof patternRecognitionPayload>;

const NIGHT_CAMERA_THEME = {
  glyph: "blip" as const,
  featureNames: { size: t("How big it was", "كم كان حجمه"), color: t("How warm it was", "كم كانت حرارته") },
  truthEmoji: { positive: "🐾", negative: "🚫" },
};

const choice = (id: string, text: [string, string], outcome: [string, string], safe: boolean) => ({
  id,
  text: t(...text),
  outcome: t(...outcome),
  safe,
});

// ── AI Island — module 4: Online Life ──────────────────────────────────────

export const onlineLife: ModuleFixture = {
  slug: "online-life",
  order: 4,
  name: t("Online Life", "الحياة على الإنترنت"),
  description: t("Kindness, passwords and offers — and a machine that sorts seeds.", "اللطف وكلمات المرور والعروض — وآلة تفرز البذور."),
  levels: [
    {
      slug: "kind-online",
      order: 1,
      activityType: "AI_ETHICS",
      track: "AI_CONCEPTS",
      title: t("Kind Online", "لطيف على الإنترنت"),
      story: t(
        "In the island's game chat, someone is being picked on. Coco the Parrot saw it too. What does Robo Bunny do?",
        "في دردشة لعبة الجزيرة، هناك من يتعرّض للمضايقة. رأى كوكو الببغاء ذلك أيضًا. ماذا يفعل الأرنب الآلي؟",
      ),
      objective: t(
        "Practise responses to unkind behaviour online: not joining in, supporting the person targeted, and reporting to a trusted adult.",
        "التدرب على الاستجابة للسلوك غير اللطيف على الإنترنت: عدم المشاركة، ودعم الشخص المستهدَف، وإبلاغ شخص بالغ موثوق.",
      ),
      mission: t("Someone is being picked on in the chat. Choose what you'd do.", "هناك من يتعرّض للمضايقة في الدردشة. اختر ما ستفعله."),
      instructions: t(
        "Read each moment and pick a reply. Every choice shows what happens next. Finish to build your Kind Online checklist.",
        "اقرأ كل موقف واختر ردًّا. كل خيار يُظهر ما يحدث بعده. أنهِ لتبني قائمة «لطيف على الإنترنت».",
      ),
      explanation: t(
        "Unkind messages feel smaller on a screen than they are. The kind moves were simple: don't pile on, tell the person you're on their side, keep a copy and tell a trusted grown-up. Being a good friend online is the same as offline.",
        "الرسائل غير اللطيفة تبدو على الشاشة أصغر مما هي. كانت الخطوات اللطيفة بسيطة: لا تنضم إلى الإساءة، أخبر الشخص أنك إلى جانبه، احتفظ بنسخة وأخبر شخصًا بالغًا موثوقًا. الصديق الجيد على الإنترنت هو نفسه خارجه.",
      ),
      teacherNotes: {
        en: "Completion-based. Pair with the school's anti-bullying policy and name who children can tell. 'Screenshot and tell' is the concrete habit.",
      },
      difficulty: "MEDIUM",
      recommendedGradeMin: 3,
      recommendedGradeMax: 7,
      estimatedMinutes: 8,
      xpReward: 50,
      tags: ["ai", "ethics", "cyber-safety"],
      requires: [],
      hints: hints(
        ["Pick what you'd honestly do, then read what happens.", "اختر ما ستفعله بصدق، ثم اقرأ ما يحدث."],
        ["Think about how the person being picked on feels.", "فكّر في شعور الشخص الذي يتعرّض للمضايقة."],
        ["A trusted grown-up can help in ways a chat reply can't.", "يستطيع شخص بالغ موثوق المساعدة بطرق لا يستطيعها ردّ في الدردشة."],
        ["Finish the story and read every line of the checklist.", "أنهِ القصة واقرأ كل سطر في القائمة."],
      ),
      payload: {
        prompt: t("Something unkind is happening in the game chat. What do you do?", "يحدث شيء غير لطيف في دردشة اللعبة. ماذا تفعل؟"),
        scenes: [
          {
            id: "pile-on",
            text: t("Three players are laughing at Fenn's drawing. 'Say it's ugly too!' one writes to you.", "ثلاثة لاعبين يضحكون على رسمة فِنّ. يكتب لك أحدهم: «قل إنها قبيحة أنت أيضًا!»"),
            art: "💬",
            choices: [
              choice("join", ["Join in so they like me", "أنضم كي يحبوني"], ["Now Fenn has four people against him instead of three. Joining in makes it bigger.", "صار ضد فِنّ أربعة بدل ثلاثة. المشاركة تكبّر الإساءة."], false),
              choice("dont-join", ["Don't join in", "لا أنضم"], ["Good start. Not adding to it matters — one fewer voice.", "بداية جيدة. عدم الإضافة مهم — صوت أقل."], true),
              choice("stand-up", ["Say 'That's not kind, stop'", "أقول «هذا ليس لطيفًا، توقفوا»"], ["Brave. Sometimes one calm voice is enough to change the chat.", "شجاع. أحيانًا يكفي صوت هادئ واحد لتغيير الدردشة."], true),
            ],
          },
          {
            id: "support",
            text: t("Fenn goes quiet. What next?", "صمت فِنّ. ماذا بعد؟"),
            art: "🦊",
            choices: [
              choice("ignore", ["Carry on playing", "أواصل اللعب"], ["Fenn is left feeling alone, even though you didn't join in.", "يبقى فِنّ يشعر بالوحدة، مع أنك لم تنضم."], false),
              choice("message", ["Tell Fenn 'I liked your drawing'", "أقول لفِنّ «أعجبتني رسمتك»"], ["Fenn replies with a smiley. One kind message can undo a lot.", "يردّ فِنّ بوجه مبتسم. رسالة لطيفة واحدة تستطيع إصلاح الكثير."], true),
            ],
          },
          {
            id: "tell",
            text: t("The next day it happens again, worse.", "في اليوم التالي يتكرر الأمر، وبشكل أسوأ."),
            art: "📸",
            choices: [
              choice("fight-back", ["Write something mean back", "أكتب ردًّا مسيئًا"], ["Now there are two fights instead of one, and you're in one of them.", "صار هناك شجاران بدل واحد، وأنت في أحدهما."], false),
              choice("screenshot", ["Take a screenshot and tell a grown-up", "ألتقط صورة للشاشة وأخبر شخصًا بالغًا"], ["Exactly right. A copy shows what happened, and grown-ups can report and block.", "صحيح تمامًا. النسخة تُظهر ما حدث، والبالغون يستطيعون الإبلاغ والحظر."], true),
              choice("report", ["Use the game's Report button", "أستخدم زر «الإبلاغ» في اللعبة"], ["Good — and tell a grown-up too, so someone who knows you can help.", "جيد — وأخبر شخصًا بالغًا أيضًا، ليساعدك من يعرفك."], true),
            ],
          },
        ],
        takeaways: [
          t("I don't join in when someone is being picked on.", "لا أنضم عندما يتعرّض أحد للمضايقة."),
          t("A kind message to the person helps a lot.", "رسالة لطيفة للشخص تساعد كثيرًا."),
          t("I screenshot unkind messages and tell a trusted grown-up.", "ألتقط صورة للرسائل المسيئة وأخبر شخصًا بالغًا موثوقًا."),
          t("I don't answer meanness with meanness.", "لا أردّ على الإساءة بالإساءة."),
        ],
      } satisfies AiEthicsDraft,
    },
    {
      slug: "strong-passwords",
      order: 2,
      activityType: "AI_ETHICS",
      track: "AI_CONCEPTS",
      title: t("Password Power", "قوة كلمة المرور"),
      story: t(
        "Professor Pip is setting up Robo Bunny's new account and asks for help with the password.",
        "يُنشئ البروفيسور بيب حسابًا جديدًا للأرنب الآلي ويطلب المساعدة في كلمة المرور.",
      ),
      objective: t(
        "Choose strong, private passwords and recognise unsafe password habits.",
        "اختيار كلمات مرور قوية وخاصة والتعرّف على عادات كلمات المرور غير الآمنة.",
      ),
      mission: t("Help Robo Bunny pick and protect a good password.", "ساعد الأرنب الآلي على اختيار كلمة مرور جيدة وحمايتها."),
      instructions: t("Pick an answer at each step and read what happens.", "اختر إجابة في كل خطوة واقرأ ما يحدث."),
      explanation: t(
        "A good password is long, hard to guess and yours alone — a silly sentence of three words beats a name and a birthday. And the best password in the world stops working the moment you share it.",
        "كلمة المرور الجيدة طويلة وصعبة التخمين ولك وحدك — جملة مضحكة من ثلاث كلمات أفضل من اسم وتاريخ ميلاد. وأفضل كلمة مرور في العالم تتوقف عن العمل لحظة مشاركتها.",
      ),
      teacherNotes: { en: "Completion-based. Children should NOT type real passwords anywhere in class; this level only discusses them." },
      difficulty: "EASY",
      recommendedGradeMin: 3,
      recommendedGradeMax: 7,
      estimatedMinutes: 6,
      xpReward: 40,
      tags: ["ai", "ethics", "cyber-safety"],
      requires: [],
      hints: hints(
        ["Which password would be hardest for someone else to guess?", "أي كلمة مرور ستكون الأصعب على غيرك تخمينها؟"],
        ["Names, birthdays and 1234 are the first things people guess.", "الأسماء وتواريخ الميلاد و1234 أول ما يخمّنه الناس."],
        ["Who should know your password? Only you and your grown-ups.", "من يجب أن يعرف كلمة مرورك؟ أنت والبالغون المسؤولون عنك فقط."],
        ["Finish the story and read the checklist.", "أنهِ القصة واقرأ القائمة."],
      ),
      payload: {
        prompt: t("Robo Bunny needs a password. What do you choose?", "يحتاج الأرنب الآلي إلى كلمة مرور. ماذا تختار؟"),
        scenes: [
          {
            id: "choose",
            text: t("Which password is best?", "أي كلمة مرور هي الأفضل؟"),
            art: "🔑",
            choices: [
              choice("name", ["robobunny", "robobunny"], ["That's the first thing anyone would try.", "هذا أول ما سيجرّبه أي شخص."], false),
              choice("numbers", ["1234", "1234"], ["It's one of the most-used passwords in the world — guessed in seconds.", "إنها من أكثر كلمات المرور استخدامًا في العالم — تُخمَّن في ثوانٍ."], false),
              choice("sentence", ["purple-carrot-jumps-9", "purple-carrot-jumps-9"], ["Long, silly and easy for you to remember — hard for anyone to guess.", "طويلة ومضحكة وسهلة التذكّر عليك — وصعبة التخمين على غيرك."], true),
            ],
          },
          {
            id: "share",
            text: t("Your best friend asks for your password 'just to look'.", "يطلب صديقك المقرّب كلمة مرورك «فقط ليلقي نظرة»."),
            art: "🤝",
            choices: [
              choice("give", ["Tell them — they're my friend", "أخبره — إنه صديقي"], ["Friends fall out sometimes, and then they still have it. Friendship isn't a password.", "الأصدقاء يتخاصمون أحيانًا، ويبقى معهم الرمز. الصداقة ليست كلمة مرور."], false),
              choice("keep", ["Keep it to myself, kindly", "أحتفظ بها لنفسي، بلطف"], ["Right. Real friends understand a password is private.", "صحيح. الأصدقاء الحقيقيون يفهمون أن كلمة المرور خاصة."], true),
            ],
          },
          {
            id: "shared-computer",
            text: t("You logged in on the class computer. Time to go.", "سجّلت الدخول على حاسوب الفصل. حان وقت الذهاب."),
            art: "💻",
            choices: [
              choice("leave", ["Just walk away", "أمشي فحسب"], ["The next person can use your account as if they were you.", "يستطيع الشخص التالي استخدام حسابك كأنه أنت."], false),
              choice("logout", ["Sign out first", "أسجّل الخروج أولًا"], ["Perfect. Signing out on shared computers is a strong habit.", "ممتاز. تسجيل الخروج على الحواسيب المشتركة عادة قوية."], true),
            ],
          },
        ],
        takeaways: [
          t("A long, silly sentence makes a strong password.", "الجملة الطويلة المضحكة تصنع كلمة مرور قوية."),
          t("I never use my name, birthday or 1234.", "لا أستخدم اسمي أو تاريخ ميلادي أو 1234 أبدًا."),
          t("My password is only for me and my grown-ups.", "كلمة مروري لي وللبالغين المسؤولين عني فقط."),
          t("I sign out on shared computers.", "أسجّل الخروج على الحواسيب المشتركة."),
        ],
      } satisfies AiEthicsDraft,
    },
    {
      slug: "ads-and-offers",
      order: 3,
      activityType: "AI_ETHICS",
      track: "AI_CONCEPTS",
      title: t("Offers Everywhere", "عروض في كل مكان"),
      story: t(
        "Robo Bunny's new game is full of pop-ups: prizes, coins, special offers. Some are adverts. Some cost real money.",
        "لعبة الأرنب الآلي الجديدة مليئة بالنوافذ المنبثقة: جوائز وعملات وعروض خاصة. بعضها إعلانات. وبعضها يكلّف مالًا حقيقيًا.",
      ),
      objective: t(
        "Recognise adverts and in-app purchases, and pause and ask before spending or clicking.",
        "التعرّف على الإعلانات والمشتريات داخل التطبيق، والتوقف والسؤال قبل الإنفاق أو النقر.",
      ),
      mission: t("Spot the adverts and offers — and decide what to do.", "اكتشف الإعلانات والعروض — وقرّر ماذا تفعل."),
      instructions: t("Pick what you'd do at each pop-up and read what happens.", "اختر ما ستفعله عند كل نافذة منبثقة واقرأ ما يحدث."),
      explanation: t(
        "Games and apps are made by companies, and some of what pops up is there to sell. 'Free', 'only today' and 'you won!' are clues to slow down. Asking a grown-up before tapping Buy or an advert is always a good move.",
        "الألعاب والتطبيقات تصنعها شركات، وبعض ما يظهر فيها موجود للبيع. «مجاني» و«اليوم فقط» و«لقد فزت!» إشارات لكي تتمهّل. سؤال شخص بالغ قبل الضغط على «شراء» أو على إعلان خطوة جيدة دائمًا.",
      ),
      teacherNotes: { en: "Completion-based. Media-literacy basics: adverts, 'free' games with paid items, prize pop-ups." },
      difficulty: "EASY",
      recommendedGradeMin: 3,
      recommendedGradeMax: 6,
      estimatedMinutes: 6,
      xpReward: 40,
      tags: ["ai", "ethics", "media-literacy"],
      requires: [],
      hints: hints(
        ["Who made this pop-up, and what do they want?", "من صنع هذه النافذة المنبثقة، وماذا يريد؟"],
        ["'Only today!' is a trick to stop you thinking.", "«اليوم فقط!» حيلة لمنعك من التفكير."],
        ["Buying anything with real money is a grown-up question.", "شراء أي شيء بمال حقيقي سؤال للبالغين."],
        ["Finish the story and read the checklist.", "أنهِ القصة واقرأ القائمة."],
      ),
      payload: {
        prompt: t("A pop-up appears in the game. What do you do?", "تظهر نافذة منبثقة في اللعبة. ماذا تفعل؟"),
        scenes: [
          {
            id: "prize",
            text: t("'CONGRATULATIONS! You won a prize! Tap here!'", "«مبروك! لقد فزت بجائزة! انقر هنا!»"),
            art: "🎁",
            choices: [
              choice("tap", ["Tap it", "أنقر عليها"], ["It opens an advert and asks for your name and address. There was no prize.", "تفتح إعلانًا وتطلب اسمك وعنوانك. لم تكن هناك جائزة."], false),
              choice("close", ["Close it — I didn't enter anything", "أغلقها — لم أشارك في شيء"], ["Smart. You can't win something you never entered.", "ذكي. لا يمكنك الفوز بشيء لم تشارك فيه."], true),
            ],
          },
          {
            id: "gems",
            text: t("'Get 500 gems now! Only 4.99!' The Buy button is big and shiny.", "«احصل على 500 جوهرة الآن! فقط بـ 4.99!» زر «شراء» كبير ولامع."),
            art: "💎",
            choices: [
              choice("buy", ["Buy them quickly", "أشتريها بسرعة"], ["That was real money from a grown-up's card, without asking.", "كان ذلك مالًا حقيقيًا من بطاقة شخص بالغ، دون سؤال."], false),
              choice("ask", ["Ask a grown-up first", "أسأل شخصًا بالغًا أولًا"], ["Exactly right. Spending real money is always a family decision.", "صحيح تمامًا. إنفاق المال الحقيقي قرار عائلي دائمًا."], true),
              choice("skip", ["Skip it and keep playing", "أتجاوزها وأواصل اللعب"], ["Good. The game is still fun without gems.", "جيد. اللعبة ما زالت ممتعة بلا جواهر."], true),
            ],
          },
          {
            id: "influencer",
            text: t("A video star says 'Everyone cool uses this app!' at the start of a video.", "يقول نجم فيديو في بداية مقطع: «كل الرائعين يستخدمون هذا التطبيق!»"),
            art: "📺",
            choices: [
              choice("believe", ["I should get it too", "يجب أن أحصل عليه أنا أيضًا"], ["They were paid to say it. It's an advert dressed up as a friend.", "دُفع لهم ليقولوا ذلك. إنه إعلان متنكّر في هيئة صديق."], false),
              choice("advert", ["That might be an advert", "قد يكون هذا إعلانًا"], ["Good eye. Many videos include paid adverts — look for 'ad' or 'sponsored'.", "عين ثاقبة. كثير من المقاطع فيها إعلانات مدفوعة — ابحث عن «إعلان» أو «برعاية»."], true),
            ],
          },
        ],
        takeaways: [
          t("Pop-up prizes are usually adverts.", "الجوائز المنبثقة غالبًا إعلانات."),
          t("I ask a grown-up before buying anything.", "أسأل شخصًا بالغًا قبل شراء أي شيء."),
          t("'Only today!' means slow down.", "«اليوم فقط!» تعني تمهّل."),
          t("People in videos are sometimes paid to say things.", "يُدفع أحيانًا للناس في المقاطع ليقولوا أشياء."),
        ],
      } satisfies AiEthicsDraft,
    },
    {
      slug: "seed-sorter",
      order: 4,
      activityType: "AI_CLASSIFICATION",
      track: "AI_CONCEPTS",
      title: t("Seed Sorter", "فارز البذور"),
      story: t(
        "Coco the Parrot can only crack small seeds. Teach Robo Bunny which seeds Coco can eat — this time the colour is the trick.",
        "كوكو الببغاء لا يستطيع كسر إلا البذور الصغيرة. علّم الأرنب الآلي أي البذور يستطيع كوكو أكلها — هذه المرة اللون هو الخدعة.",
      ),
      objective: t(
        "Train a classifier where size, not colour, decides, and choose examples that make the real feature visible.",
        "تدريب مصنّف يحسم فيه الحجم لا اللون، واختيار أمثلة تُظهر الخاصية الحقيقية.",
      ),
      mission: t("Teach Robo Bunny which seeds are small enough for Coco.", "علّم الأرنب الآلي أي البذور صغيرة بما يكفي لكوكو."),
      instructions: t(
        "Put seeds in the two baskets to teach. Then Robo Bunny sorts the new seeds marked ?. Get both right.",
        "ضع البذور في السلّتين لتعليمه. ثم يفرز الأرنب الآلي البذور الجديدة المعلَّمة بـ؟. أصب الاثنتين.",
      ),
      explanation: t(
        "In Teach the Bunny colour decided; here size did. The machine never knows which one matters — it copies what your examples show. Teach with small seeds of every colour and big seeds of every colour, and colour stops fooling it.",
        "في «علّم الأرنب» حسم اللون؛ وهنا حسم الحجم. الآلة لا تعرف أبدًا أيهما المهم — بل تنسخ ما تُظهره أمثلتك. علّمها ببذور صغيرة من كل لون وبذور كبيرة من كل لون، فيتوقف اللون عن خداعها.",
      ),
      teacherNotes: { en: "Mirror of berry-sorter with size deciding. Colour is usually right in the pool, so teaching only typical seeds fails the rare-looking test seeds. Ask: how would the machine know which measurement matters?" },
      difficulty: "EASY",
      recommendedGradeMin: 4,
      recommendedGradeMax: 7,
      estimatedMinutes: 6,
      xpReward: 45,
      tags: ["ai", "classification"],
      requires: [],
      hints: hints(
        ["Put a few seeds in each basket.", "ضع بضع بذور في كل سلّة."],
        ["Which seeds does it get wrong? What do they look like?", "أي البذور يخطئ فيها؟ كيف تبدو؟"],
        ["Only one thing decides: size or colour?", "شيء واحد فقط يحسم: الحجم أم اللون؟"],
        ["Include the small DARK seed and the big LIGHT seed — the rare ones.", "أدرج البذرة الصغيرة الغامقة والبذرة الكبيرة الفاتحة — النادرتين."],
      ),
      payload: {
        conceptSlug: "training-by-example",
        labels: { positive: t("Small enough for Coco", "صغيرة بما يكفي لكوكو"), negative: t("Too big for Coco", "كبيرة جدًّا على كوكو") },
        theme: {
          glyph: "grain",
          featureNames: { size: t("Size", "الحجم"), color: t("Colour", "اللون") },
          truthEmoji: { positive: "🦜", negative: "🚫" },
        },
        // Size decides; colour is a decoy that is USUALLY right here — most
        // small seeds are light and most big ones dark. The two rare seeds
        // (s3 small-dark, b3 big-light) are what the held-out seeds look like,
        // so teaching only the typical ones fails.
        pool: [
          { id: "s1", size: 0.15, color: 0.1, truth: "positive" },
          { id: "s2", size: 0.25, color: 0.2, truth: "positive" },
          { id: "s3", size: 0.3, color: 0.9, truth: "positive" },
          { id: "b1", size: 0.75, color: 0.85, truth: "negative" },
          { id: "b2", size: 0.85, color: 0.9, truth: "negative" },
          { id: "b3", size: 0.7, color: 0.15, truth: "negative" },
        ],
        testSet: [
          { id: "t1", size: 0.35, color: 0.95 },
          { id: "t2", size: 0.65, color: 0.1 },
        ],
        rule: { feature: "size", threshold: 0.5 },
        minPerLabel: 2,
        starCriteria: { threeStarMaxBlocks: 6 },
      } satisfies AiClassificationDraft,
    },
  ],
};

// ── Data Desert — module 4: More Readings ──────────────────────────────────

export const moreReadings: ModuleFixture = {
  slug: "more-readings",
  order: 4,
  name: t("More Readings", "قراءات أخرى"),
  description: t("Closer crowds, four camps, a strange reading, and desert flowers.", "حشود أقرب، وأربعة مخيمات، وقراءة غريبة، وأزهار الصحراء."),
  levels: [
    {
      slug: "close-crowds",
      order: 1,
      activityType: "PATTERN_RECOGNITION",
      track: "AI_CONCEPTS",
      title: t("Close Crowds", "حشود متقاربة"),
      story: t(
        "Two kinds of animal visited the same waterhole, and their readings sit close together. The gap is narrow — but it's there.",
        "زار نوعان من الحيوانات مورد الماء نفسه، وقراءاتهما متقاربة. الفجوة ضيقة — لكنها موجودة.",
      ),
      objective: t(
        "Place two markers to separate clusters with a narrow gap, using the tightness score to refine placement.",
        "وضع علامتين لفصل مجموعتين بينهما فجوة ضيقة، باستخدام درجة التراصّ لتحسين الموضع.",
      ),
      mission: t("Plant two flags so each crowd hugs its own flag.", "اغرس علمين بحيث يلتفّ كل حشد حول علمه."),
      instructions: t(
        "Look closely: the two crowds nearly touch. Put one flag in the middle of each. Watch the meter as you move them.",
        "انظر عن قرب: الحشدان يكادان يتلامسان. ضع علمًا في وسط كل منهما. راقب العداد وأنت تحرّكهما.",
      ),
      explanation: t(
        "When groups are close, where the flags sit matters more. The middle of each crowd is still the best place — the machine's idea of a group is just 'nearest flag'.",
        "عندما تكون المجموعات متقاربة، يصبح موضع الأعلام أهم. ووسط كل حشد يبقى أفضل مكان — ففكرة الآلة عن المجموعة هي ببساطة «أقرب علم».",
      ),
      teacherNotes: { en: "Harder follow-up to Two Piles: clusters closer, bar slightly lower. Reference placement verified in tests." },
      difficulty: "MEDIUM",
      recommendedGradeMin: 4,
      recommendedGradeMax: 7,
      estimatedMinutes: 6,
      xpReward: 45,
      tags: ["ai", "clustering"],
      requires: [],
      hints: hints(
        ["Find the narrow gap between the two crowds.", "ابحث عن الفجوة الضيقة بين الحشدين."],
        ["A flag near the gap pulls readings from both crowds.", "العلم القريب من الفجوة يسحب قراءات من الحشدين."],
        ["Put each flag in the middle of its crowd, away from the gap.", "ضع كل علم في وسط حشده، بعيدًا عن الفجوة."],
        ["One flag near the small cool readings, one near the bigger warmer ones.", "علم قرب القراءات الصغيرة الباردة، وآخر قرب الأكبر الأدفأ."],
      ),
      payload: {
        conceptSlug: "clustering",
        theme: NIGHT_CAMERA_THEME,
        specimens: [
          { id: "a1", size: 0.3, color: 0.35 },
          { id: "a2", size: 0.36, color: 0.4 },
          { id: "a3", size: 0.32, color: 0.44 },
          { id: "a4", size: 0.4, color: 0.36 },
          { id: "a5", size: 0.34, color: 0.3 },
          { id: "a6", size: 0.38, color: 0.42 },
          { id: "b1", size: 0.6, color: 0.62 },
          { id: "b2", size: 0.66, color: 0.58 },
          { id: "b3", size: 0.62, color: 0.68 },
          { id: "b4", size: 0.7, color: 0.64 },
          { id: "b5", size: 0.64, color: 0.72 },
          { id: "b6", size: 0.68, color: 0.66 },
        ],
        markers: { min: 2, max: 2 },
        maxExclusions: 0,
        objective: { minTightness: 0.75 },
        groundTruth: {
          referencePlacement: [
            { size: 0.35, color: 0.38 },
            { size: 0.65, color: 0.65 },
          ],
          hiddenKinds: { a1: 0, a2: 0, a3: 0, a4: 0, a5: 0, a6: 0, b1: 1, b2: 1, b3: 1, b4: 1, b5: 1, b6: 1 },
          kindNames: [t("Desert hedgehogs", "قنافذ الصحراء"), t("Sand foxes", "ثعالب الرمال")],
        },
        starCriteria: {},
      } satisfies PrDraft,
    },
    {
      slug: "four-camps",
      order: 2,
      activityType: "PATTERN_RECOGNITION",
      track: "AI_CONCEPTS",
      title: t("Four Camps", "أربعة مخيمات"),
      story: t(
        "Dr. Nova's camera covered four corners of the desert at once. Sixteen readings, four camps.",
        "غطّت كاميرا الدكتورة نوفا أربع زوايا من الصحراء في آن واحد. ست عشرة قراءة، وأربعة مخيمات.",
      ),
      objective: t(
        "Cluster unlabelled data into four groups by placing four markers.",
        "تجميع بيانات غير مسمّاة في أربع مجموعات بوضع أربع علامات.",
      ),
      mission: t("Plant four flags — one for each camp.", "اغرس أربعة أعلام — علمًا لكل مخيم."),
      instructions: t("Count the crowds, then put one flag in the middle of each.", "عُدّ الحشود، ثم ضع علمًا في وسط كل منها."),
      explanation: t(
        "Four flags, four groups — found without a single label. The more groups there are, the more it matters that every flag has its own crowd.",
        "أربعة أعلام، وأربع مجموعات — وُجدت دون تسمية واحدة. كلما زادت المجموعات، زادت أهمية أن يكون لكل علم حشده.",
      ),
      teacherNotes: { en: "Four well-separated clusters in the corners. A common mistake is two flags in one corner." },
      difficulty: "MEDIUM",
      recommendedGradeMin: 4,
      recommendedGradeMax: 7,
      estimatedMinutes: 6,
      xpReward: 45,
      tags: ["ai", "clustering"],
      requires: [],
      hints: hints(
        ["How many crowds are on the board?", "كم حشدًا على اللوحة؟"],
        ["The crowds sit in the four corners.", "تقع الحشود في الزوايا الأربع."],
        ["Two flags in the same corner leave another corner without one.", "علمان في الزاوية نفسها يتركان زاوية أخرى بلا علم."],
        ["One flag in each corner's crowd.", "علم واحد في حشد كل زاوية."],
      ),
      payload: {
        conceptSlug: "clustering",
        theme: NIGHT_CAMERA_THEME,
        specimens: [
          { id: "a1", size: 0.15, color: 0.15 }, { id: "a2", size: 0.2, color: 0.22 }, { id: "a3", size: 0.12, color: 0.24 }, { id: "a4", size: 0.22, color: 0.12 },
          { id: "b1", size: 0.8, color: 0.15 }, { id: "b2", size: 0.86, color: 0.2 }, { id: "b3", size: 0.78, color: 0.24 }, { id: "b4", size: 0.88, color: 0.12 },
          { id: "c1", size: 0.15, color: 0.82 }, { id: "c2", size: 0.2, color: 0.88 }, { id: "c3", size: 0.12, color: 0.78 }, { id: "c4", size: 0.24, color: 0.84 },
          { id: "d1", size: 0.82, color: 0.84 }, { id: "d2", size: 0.86, color: 0.78 }, { id: "d3", size: 0.78, color: 0.88 }, { id: "d4", size: 0.88, color: 0.86 },
        ],
        markers: { min: 4, max: 4 },
        maxExclusions: 0,
        objective: { minTightness: 0.85 },
        groundTruth: {
          referencePlacement: [
            { size: 0.17, color: 0.18 },
            { size: 0.83, color: 0.18 },
            { size: 0.18, color: 0.83 },
            { size: 0.84, color: 0.84 },
          ],
          hiddenKinds: { a1: 0, a2: 0, a3: 0, a4: 0, b1: 1, b2: 1, b3: 1, b4: 1, c1: 2, c2: 2, c3: 2, c4: 2, d1: 3, d2: 3, d3: 3, d4: 3 },
          kindNames: [t("Beetles", "خنافس"), t("Lizards", "سحالي"), t("Owls", "بوم"), t("Camels", "جِمال")],
        },
        starCriteria: {},
      } satisfies PrDraft,
    },
    {
      slug: "one-strange-reading",
      order: 3,
      activityType: "PATTERN_RECOGNITION",
      track: "AI_CONCEPTS",
      title: t("One Strange Reading", "قراءة واحدة غريبة"),
      story: t(
        "Two tidy crowds — and one reading far away from everything, where no animal could be. A wind-blown bag, maybe.",
        "حشدان مرتّبان — وقراءة واحدة بعيدة عن كل شيء، حيث لا يمكن أن يكون حيوان. ربما كيس حملته الريح.",
      ),
      objective: t(
        "Identify and exclude an outlier that would distort the groups, then cluster the rest.",
        "تحديد قيمة شاذة قد تشوّه المجموعات واستبعادها، ثم تجميع الباقي.",
      ),
      mission: t("Strike out the strange reading, then plant two flags.", "اشطب القراءة الغريبة، ثم اغرس علمين."),
      instructions: t(
        "You may strike out one reading. Find the one that belongs to no crowd, then put a flag in the middle of each crowd.",
        "يمكنك شطب قراءة واحدة. ابحث عن التي لا تنتمي إلى أي حشد، ثم ضع علمًا في وسط كل حشد.",
      ),
      explanation: t(
        "One bad reading can drag a whole group's flag away. Real data scientists look for readings that can't be real before they trust the groups — and they write down why they removed each one.",
        "قراءة سيئة واحدة تستطيع سحب علم مجموعة كاملة بعيدًا. يبحث علماء البيانات الحقيقيون عن القراءات المستحيلة قبل أن يثقوا بالمجموعات — ويدوّنون سبب حذف كل واحدة.",
      ),
      teacherNotes: { en: "Echoes impossible-reading with a clearer outlier. Discuss: when is removing data honest, and when is it cheating?" },
      difficulty: "MEDIUM",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 7,
      xpReward: 50,
      tags: ["ai", "clustering", "data"],
      requires: [],
      hints: hints(
        ["Is there a reading far from both crowds?", "هل هناك قراءة بعيدة عن الحشدين؟"],
        ["Strike out the reading in the empty corner.", "اشطب القراءة في الزاوية الفارغة."],
        ["Then one flag per crowd.", "ثم علم لكل حشد."],
        ["Strike the lone reading, flags at the middle of the two crowds.", "اشطب القراءة المنفردة، والعلمان في وسط الحشدين."],
      ),
      payload: {
        conceptSlug: "clustering",
        theme: NIGHT_CAMERA_THEME,
        specimens: [
          { id: "a1", size: 0.2, color: 0.7 }, { id: "a2", size: 0.26, color: 0.76 }, { id: "a3", size: 0.18, color: 0.8 }, { id: "a4", size: 0.24, color: 0.68 }, { id: "a5", size: 0.28, color: 0.74 },
          { id: "b1", size: 0.72, color: 0.7 }, { id: "b2", size: 0.78, color: 0.76 }, { id: "b3", size: 0.7, color: 0.8 }, { id: "b4", size: 0.76, color: 0.68 }, { id: "b5", size: 0.8, color: 0.74 },
          { id: "odd", size: 0.5, color: 0.02 },
        ],
        markers: { min: 2, max: 2 },
        maxExclusions: 1,
        objective: { minTightness: 0.93 },
        groundTruth: {
          referencePlacement: [
            { size: 0.23, color: 0.74 },
            { size: 0.75, color: 0.74 },
          ],
          hiddenKinds: { a1: 0, a2: 0, a3: 0, a4: 0, a5: 0, b1: 1, b2: 1, b3: 1, b4: 1, b5: 1 },
          kindNames: [t("Jerboas", "يرابيع"), t("Hares", "أرانب برية")],
        },
        starCriteria: {},
      } satisfies PrDraft,
    },
    {
      slug: "desert-flowers",
      order: 4,
      activityType: "AI_CLASSIFICATION",
      track: "AI_CONCEPTS",
      title: t("Desert Flowers", "أزهار الصحراء"),
      story: t(
        "After rain, the desert blooms. Only the palest flowers have nectar yet. Teach Robo Bunny where the line is — it isn't in the middle.",
        "بعد المطر تزهر الصحراء. أفتح الأزهار وحدها فيها رحيق حتى الآن. علّم الأرنب الآلي أين الخط — إنه ليس في المنتصف.",
      ),
      objective: t(
        "Train a classifier whose boundary is off-centre, choosing examples near the real boundary.",
        "تدريب مصنّف حدّه ليس في المنتصف، باختيار أمثلة قرب الحدّ الحقيقي.",
      ),
      mission: t("Teach Robo Bunny which flowers have nectar.", "علّم الأرنب الآلي أي الأزهار فيها رحيق."),
      instructions: t("Teach with examples from both baskets, then check the new flowers marked ?.", "علّمه بأمثلة من السلّتين، ثم تحقّق من الأزهار الجديدة المعلَّمة بـ؟."),
      explanation: t(
        "The edge between nectar and no nectar sat near the pale end, not halfway. The examples closest to that edge taught the machine the most — the obvious ones far away taught it almost nothing.",
        "كان الحدّ بين وجود الرحيق وغيابه قرب الطرف الفاتح، لا في المنتصف. الأمثلة الأقرب إلى ذلك الحدّ علّمت الآلة أكثر — أما الواضحة البعيدة فلم تعلّمها شيئًا تقريبًا.",
      ),
      teacherNotes: { en: "Threshold at 0.3 on colour. Links to Where Does the Line Go?: boundary examples matter most." },
      difficulty: "MEDIUM",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 7,
      xpReward: 50,
      tags: ["ai", "classification", "boundary"],
      requires: [],
      hints: hints(
        ["Which flowers does it get wrong?", "أي الأزهار يخطئ فيها؟"],
        ["The line isn't halfway — it's near the pale end.", "الخط ليس في المنتصف — بل قرب الطرف الفاتح."],
        ["Teach with flowers just either side of where nectar stops.", "علّمه بأزهار على جانبي الموضع الذي ينتهي عنده الرحيق مباشرة."],
        ["Include the palest no-nectar flower and the darkest nectar flower.", "أدرج أفتح زهرة بلا رحيق وأغمق زهرة فيها رحيق."],
      ),
      payload: {
        conceptSlug: "training-by-example",
        labels: { positive: t("Has nectar", "فيها رحيق"), negative: t("No nectar yet", "لا رحيق بعد") },
        pool: [
          { id: "f1", size: 0.5, color: 0.08, truth: "positive" },
          { id: "f2", size: 0.4, color: 0.18, truth: "positive" },
          { id: "f3", size: 0.6, color: 0.26, truth: "positive" },
          { id: "f4", size: 0.45, color: 0.36, truth: "negative" },
          { id: "f5", size: 0.55, color: 0.6, truth: "negative" },
          { id: "f6", size: 0.5, color: 0.9, truth: "negative" },
        ],
        testSet: [
          { id: "t1", size: 0.5, color: 0.24 },
          { id: "t2", size: 0.5, color: 0.4 },
        ],
        rule: { feature: "color", threshold: 0.3 },
        minPerLabel: 1,
        maxExamples: 4,
        starCriteria: { threeStarMaxBlocks: 3 },
      } satisfies AiClassificationDraft,
    },
  ],
};

// ── ML Lab — module 2: Deciding Well ───────────────────────────────────────

export const decidingWell: ModuleFixture = {
  slug: "deciding-well",
  order: 2,
  name: t("Deciding Well", "القرار الحكيم"),
  description: t("Who should decide, and how few examples are enough.", "من يجب أن يقرّر، وكم مثالًا يكفي."),
  levels: [
    {
      slug: "who-decides",
      order: 1,
      activityType: "AI_ETHICS",
      track: "MACHINE_LEARNING",
      title: t("Who Decides?", "من يقرّر؟"),
      story: t(
        "Dr. Nova's lab machine is good at sorting — but should it decide everything on its own? Three situations, three choices.",
        "آلة مختبر الدكتورة نوفا بارعة في الفرز — لكن هل يجب أن تقرّر كل شيء وحدها؟ ثلاثة مواقف، وثلاثة خيارات.",
      ),
      objective: t(
        "Reason about when an AI's decision needs a human check, based on how costly a mistake would be.",
        "التفكير في متى يحتاج قرار الذكاء الاصطناعي إلى مراجعة بشرية، بناءً على كلفة الخطأ.",
      ),
      mission: t("Decide when the machine can decide — and when a person should check.", "قرّر متى تستطيع الآلة أن تقرّر — ومتى يجب أن يتحقق شخص."),
      instructions: t("Read each situation and pick who should decide.", "اقرأ كل موقف واختر من يجب أن يقرّر."),
      explanation: t(
        "Machines make mistakes, like people do. When a mistake is small (a wrong song suggestion) the machine can decide. When a mistake could hurt someone (health, fairness, safety), a person should check. That rule is how responsible teams use AI.",
        "الآلات تخطئ كما يخطئ الناس. عندما يكون الخطأ صغيرًا (اقتراح أغنية خاطئ) تستطيع الآلة أن تقرّر. وعندما قد يؤذي الخطأ أحدًا (الصحة، الإنصاف، السلامة) يجب أن يتحقق شخص. هذه القاعدة هي طريقة الفرق المسؤولة في استخدام الذكاء الاصطناعي.",
      ),
      teacherNotes: { en: "Completion-based. The idea is 'cost of a mistake decides how much a human checks' — human-in-the-loop, without the jargon." },
      difficulty: "MEDIUM",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 7,
      xpReward: 50,
      tags: ["ai", "ethics", "ml"],
      requires: [],
      hints: hints(
        ["What happens if the machine is wrong here?", "ماذا يحدث إن أخطأت الآلة هنا؟"],
        ["Small mistake: fine for the machine. Big mistake: a person checks.", "خطأ صغير: لا بأس بالآلة. خطأ كبير: يتحقق شخص."],
        ["Think about who could be hurt by a wrong answer.", "فكّر في من قد يتأذى من إجابة خاطئة."],
        ["Finish the story and read the checklist.", "أنهِ القصة واقرأ القائمة."],
      ),
      payload: {
        prompt: t("The machine has made a decision. Who should have the final say?", "اتخذت الآلة قرارًا. من يجب أن تكون له الكلمة الأخيرة؟"),
        scenes: [
          {
            id: "songs",
            text: t("The machine picks which song to play next at the Fair.", "تختار الآلة الأغنية التالية في المعرض."),
            art: "🎵",
            choices: [
              choice("machine", ["Let the machine choose", "أدع الآلة تختار"], ["Fine — if it picks a song nobody likes, you just skip it.", "لا بأس — إن اختارت أغنية لا يحبها أحد، تتخطاها فحسب."], true),
              choice("committee", ["A person must approve every song", "يجب أن يوافق شخص على كل أغنية"], ["That works, but it's a lot of checking for a very small mistake.", "هذا ينجح، لكنه تحقق كثير لخطأ صغير جدًّا."], false),
            ],
          },
          {
            id: "medicine",
            text: t("The machine guesses which berries are safe for the whole village to eat.", "تخمّن الآلة أي حبات التوت آمنة ليأكلها أهل القرية كلهم."),
            art: "🫐",
            choices: [
              choice("trust", ["Trust the machine", "أثق بالآلة"], ["If it's wrong, people get sick. A mistake here is too costly to leave to a guess.", "إن أخطأت، يمرض الناس. الخطأ هنا مكلف جدًّا ليُترك لتخمين."], false),
              choice("check", ["An expert checks before anyone eats", "يتحقق خبير قبل أن يأكل أحد"], ["Right. The machine helps, a person who knows makes sure.", "صحيح. الآلة تساعد، وشخص عارف يتأكد."], true),
            ],
          },
          {
            id: "team",
            text: t("The machine chooses who gets to be on the Fair team, from their photos.", "تختار الآلة من يكون في فريق المعرض، من صورهم."),
            art: "📷",
            choices: [
              choice("photos", ["Let it choose from photos", "أدعها تختار من الصور"], ["A photo says nothing about how good someone is — and the machine may copy unfair patterns.", "الصورة لا تقول شيئًا عن مهارة الشخص — وقد تنسخ الآلة أنماطًا غير منصفة."], false),
              choice("people", ["People choose, fairly, using what matters", "يختار الناس بإنصاف، بما هو مهم"], ["Yes. Decisions about people need people, and fair reasons.", "نعم. القرارات المتعلقة بالناس تحتاج إلى ناس، وإلى أسباب منصفة."], true),
            ],
          },
        ],
        takeaways: [
          t("Machines make mistakes too.", "الآلات تخطئ أيضًا."),
          t("Small mistakes: the machine can decide.", "الأخطاء الصغيرة: تستطيع الآلة أن تقرّر."),
          t("Big mistakes: a person who knows should check.", "الأخطاء الكبيرة: يجب أن يتحقق شخص عارف."),
          t("Decisions about people need fair reasons, not just photos.", "القرارات المتعلقة بالناس تحتاج إلى أسباب منصفة، لا إلى صور فقط."),
        ],
      } satisfies AiEthicsDraft,
    },
    {
      slug: "three-examples-only",
      order: 2,
      activityType: "AI_CLASSIFICATION",
      track: "MACHINE_LEARNING",
      title: t("Three Examples Only", "ثلاثة أمثلة فقط"),
      story: t(
        "The lab's memory chip is tiny: it can hold just three examples. Choose them well and the machine still gets every new berry right.",
        "شريحة ذاكرة المختبر صغيرة جدًّا: تتسع لثلاثة أمثلة فقط. اخترها جيدًا وستصيب الآلة كل حبة جديدة.",
      ),
      objective: t(
        "Select a minimal training set that still generalises, trading example count against coverage.",
        "اختيار أصغر مجموعة تدريب ما زالت تعمّم، بالموازنة بين عدد الأمثلة والتغطية.",
      ),
      mission: t("Teach with just three berries — and get every new one right.", "علّم بثلاث حبات فقط — وأصب كل حبة جديدة."),
      instructions: t("You may teach with at most three berries. The ? berries must all come out right.", "يمكنك التعليم بثلاث حبات على الأكثر. يجب أن تُصنَّف حبات «؟» كلها بشكل صحيح."),
      explanation: t(
        "With only three examples, each one had to earn its place: the ones near the edge between safe and unsafe carried the most information. Real machine learning is often limited like this — by memory, time or the cost of collecting data.",
        "مع ثلاثة أمثلة فقط، كان على كل مثال أن يستحق مكانه: الأمثلة القريبة من الحدّ بين الآمن وغير الآمن حملت أكثر المعلومات. تعلّم الآلة الحقيقي محدود هكذا غالبًا — بالذاكرة أو الوقت أو كلفة جمع البيانات.",
      ),
      teacherNotes: { en: "maxExamples 3. The winning sets include examples close to the colour boundary; the playthrough proves one exists." },
      difficulty: "HARD",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 8,
      xpReward: 60,
      tags: ["ai", "classification", "ml"],
      requires: [],
      hints: hints(
        ["Three is not many. Which berries tell the machine the most?", "ثلاثة ليست كثيرة. أي الحبات تخبر الآلة بأكثر شيء؟"],
        ["The berries far from the edge are easy — the machine barely needs them.", "الحبات البعيدة عن الحدّ سهلة — الآلة بالكاد تحتاجها."],
        ["Pick berries on either side of where safe turns unsafe.", "اختر حبات على جانبي الموضع الذي يتحول فيه الآمن إلى غير آمن."],
        ["One safe berry near the edge, one unsafe berry near the edge, and one more to cover the far end.", "حبة آمنة قرب الحدّ، وحبة غير آمنة قرب الحدّ، وواحدة أخرى تغطي الطرف البعيد."],
      ),
      payload: {
        conceptSlug: "training-by-example",
        labels: { positive: t("Safe to eat", "آمنة للأكل"), negative: t("Not safe", "غير آمنة") },
        pool: [
          { id: "p1", size: 0.3, color: 0.1, truth: "positive" },
          { id: "p2", size: 0.7, color: 0.3, truth: "positive" },
          { id: "p3", size: 0.5, color: 0.44, truth: "positive" },
          { id: "n1", size: 0.4, color: 0.56, truth: "negative" },
          { id: "n2", size: 0.6, color: 0.75, truth: "negative" },
          { id: "n3", size: 0.3, color: 0.92, truth: "negative" },
        ],
        testSet: [
          { id: "t1", size: 0.45, color: 0.47 },
          { id: "t2", size: 0.55, color: 0.53 },
          { id: "t3", size: 0.2, color: 0.85 },
        ],
        rule: { feature: "color", threshold: 0.5 },
        minPerLabel: 1,
        maxExamples: 3,
        starCriteria: { threeStarMaxBlocks: 3 },
      } satisfies AiClassificationDraft,
    },
  ],
};
