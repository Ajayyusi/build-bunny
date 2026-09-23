import type { z } from "zod";
import type {
  ModuleFixture,
  aiClassificationPayload,
  aiEthicsPayload,
} from "@/modules/curriculum/schemas";

/**
 * AI Island, module 3 — Safety and Fairness: two cyber-safety stories
 * (a stranger in a game chat; things online that are not what they seem,
 * including AI-made ones) and one fairness lesson on the teach-by-example
 * machine, where the "typical" examples teach a shortcut that fails on the
 * berries the machine rarely saw — bias, at a nine-year-old's scale.
 */

type AiEthicsDraft = z.input<typeof aiEthicsPayload>;
type AiClassificationDraft = z.input<typeof aiClassificationPayload>;

export const safetyAndFairness: ModuleFixture = {
  slug: "safety-and-fairness",
  order: 3,
  name: { en: "Safety and Fairness", ar: "الأمان والإنصاف" },
  description: {
    en: "Strangers, fakes, and a machine that learned a shortcut.",
    ar: "غرباء، وأشياء مزيفة، وآلة تعلّمت طريقًا مختصرًا.",
  },
  levels: [
    // ── STRANGER IN THE CHAT ─────────────────────────────────────────────
    {
      slug: "stranger-in-the-chat",
      order: 1,
      activityType: "AI_ETHICS",
      track: "AI_CONCEPTS",
      title: { en: "Stranger in the Chat", ar: "غريب في الدردشة" },
      story: {
        en: "Robo Bunny is playing an online game on the island's beach. A player it has never met starts chatting — very friendly, very quickly. Coco the Parrot is watching over its shoulder.",
        ar: "يلعب الأرنب الآلي لعبة على الإنترنت على شاطئ الجزيرة. لاعب لم يقابله من قبل يبدأ الدردشة — ودود جدًا، وبسرعة كبيرة. كوكو الببغاء يراقب من فوق كتفه.",
      },
      objective: {
        en: "Practise safe responses to four common approaches from a stranger online: personal questions, links, moving to private chat, and password requests.",
        ar: "التدرب على استجابات آمنة لأربعة أساليب شائعة يستخدمها الغرباء على الإنترنت: الأسئلة الشخصية، والروابط، والانتقال إلى دردشة خاصة، وطلب كلمات المرور.",
      },
      mission: {
        en: "A stranger is chatting in your game. Decide what to say — and what to keep to yourself.",
        ar: "غريب يدردش في لعبتك. قرّر ماذا تقول — وماذا تحتفظ به لنفسك.",
      },
      instructions: {
        en: "Read what the player says, then pick your reply. Every choice shows what happens next, so try the ones you'd never really pick too. Finish to build your Safe Chat checklist.",
        ar: "اقرأ ما يقوله اللاعب، ثم اختر ردّك. كل خيار يُظهر ما يحدث بعده، فجرّب أيضًا الخيارات التي لن تختارها فعلًا. أنهِ لتبني قائمة «الدردشة الآمنة».",
      },
      explanation: {
        en: "Friendly is not the same as trusted. Every ask in this chat was normal on its own — a school name, a link, a private chat, a password — and every safe reply was the same three moves: keep personal things personal, don't click or move somewhere a grown-up can't see, and tell a trusted grown-up when something feels off. Nobody real ever needs your password. Not a game, not a friend, not a 'helper'.",
        ar: "الودّ ليس كالثقة. كل طلب في هذه الدردشة كان عاديًا بمفرده — اسم مدرسة، رابط، دردشة خاصة، كلمة مرور — وكل ردّ آمن كان التحركات الثلاث نفسها: أبقِ الأمور الشخصية شخصية، ولا تنقر أو تنتقل إلى مكان لا يراه شخص بالغ، وأخبر شخصًا بالغًا تثق به عندما يبدو شيء غير مريح. لا أحد حقيقي يحتاج إلى كلمة مرورك أبدًا. لا لعبة، ولا صديق، ولا «مساعد».",
      },
      teacherNotes: {
        en: "Completion-based: every finished path passes; 3 stars only when the safe option was chosen at every scene, which is a discussion signal rather than a judgement. The password scene is deliberately the last: it is the one children most often get wrong, and 'nobody real needs your password' is the sentence to send home. Pair with the school's own online-safety policy and name the trusted adults explicitly.",
        ar: "التقييم قائم على الإكمال: كل مسار مكتمل ينجح؛ ولا تُمنح 3 نجوم إلا إذا اختير الخيار الآمن في كل مشهد، وهذا مؤشر للنقاش لا حكم. مشهد كلمة المرور هو الأخير عن قصد: فهو المشهد الذي يخطئ فيه الأطفال أكثر من غيره، وعبارة «لا أحد حقيقي يحتاج إلى كلمة مرورك» هي الجملة التي نريد أن يحملها الطفل معه إلى البيت. اربط هذا المستوى بسياسة الأمان على الإنترنت الخاصة بمدرستك، وسمِّ البالغين الموثوقين بأسمائهم صراحةً.",
      },
      difficulty: "MEDIUM",
      recommendedGradeMin: 3,
      recommendedGradeMax: 7,
      estimatedMinutes: 10,
      xpReward: 55,
      tags: ["ai", "ethics", "cyber-safety"],
      requires: [],
      hints: [
        { tier: 1, text: { en: "There's no wrong feeling here. Pick the reply that feels most like you, then read what happens.", ar: "لا توجد مشاعر خاطئة هنا. اختر الردّ الأقرب إليك، ثم اقرأ ما يحدث." } },
        { tier: 2, text: { en: "A stranger online is a stranger — however friendly the words are. You can always not answer.", ar: "الغريب على الإنترنت غريب — مهما كانت كلماته ودودة. يمكنك دائمًا ألا تجيب." } },
        { tier: 3, text: { en: "Links, private chats and passwords are the three things to never do alone. A trusted grown-up is always a safe reply.", ar: "الروابط والدردشات الخاصة وكلمات المرور هي الأشياء الثلاثة التي لا تفعلها وحدك أبدًا. شخص بالغ تثق به هو دائمًا ردّ آمن." } },
        { tier: 4, text: { en: "Finish the story, then read every line of the Safe Chat checklist — that list is the point.", ar: "أنهِ القصة، ثم اقرأ كل سطر في قائمة «الدردشة الآمنة» — تلك القائمة هي المقصود." } },
      ],
      payload: {
        prompt: {
          en: "A player you've never met is chatting with you in the game. What do you reply?",
          ar: "لاعب لم تقابله من قبل يدردش معك في اللعبة. بماذا تردّ؟",
        },
        scenes: [
          {
            id: "asks-school",
            text: {
              en: "'You're really good at this! Which school do you go to? I bet I know it.'",
              ar: "«أنت بارع حقًا في هذا! في أي مدرسة تدرس؟ أراهن أنني أعرفها.»",
            },
            art: "🏫",
            choices: [
              {
                id: "tell-school",
                text: { en: "Tell them my school", ar: "أخبره باسم مدرستي" },
                outcome: {
                  en: "Now a stranger knows where you are every weekday. A school name is a big clue about you — bigger than it feels.",
                  ar: "الآن يعرف غريب أين تكون كل يوم دراسي. اسم المدرسة دليل كبير عنك — أكبر مما يبدو.",
                },
                safe: false,
              },
              {
                id: "keep-private",
                text: { en: "'I don't share that, but thanks!'", ar: "«لا أشارك ذلك، لكن شكرًا!»" },
                outcome: {
                  en: "Polite and safe. A real friend in a game doesn't need to know where you go to school.",
                  ar: "مهذّب وآمن. الصديق الحقيقي في اللعبة لا يحتاج إلى معرفة مكان مدرستك.",
                },
                safe: true,
              },
              {
                id: "tell-grownup-school",
                text: { en: "Stop and tell a grown-up", ar: "أتوقف وأخبر شخصًا بالغًا" },
                outcome: {
                  en: "Good instinct. A trusted grown-up can help you decide — and it's never a bother to ask.",
                  ar: "حدس جيد. يستطيع شخص بالغ تثق به مساعدتك على القرار — والسؤال ليس إزعاجًا أبدًا.",
                },
                safe: true,
              },
            ],
          },
          {
            id: "sends-link",
            text: {
              en: "'Click this link — free coins for your account, but only for the next five minutes!'",
              ar: "«انقر على هذا الرابط — عملات مجانية لحسابك، لكن فقط خلال الدقائق الخمس القادمة!»",
            },
            art: "🔗",
            choices: [
              {
                id: "click-link",
                text: { en: "Click it quickly", ar: "أنقر عليه بسرعة" },
                outcome: {
                  en: "The page asks you to log in to 'claim' the coins — and now someone else has your login. 'Hurry!' is the oldest trick there is.",
                  ar: "تطلب الصفحة تسجيل الدخول «لاستلام» العملات — والآن صار لدى شخص آخر بيانات دخولك. «أسرع!» هي أقدم حيلة على الإطلاق.",
                },
                safe: false,
              },
              {
                id: "dont-click",
                text: { en: "Don't click — free coins don't need a hurry", ar: "لا أنقر — العملات المجانية لا تحتاج إلى عجلة" },
                outcome: {
                  en: "Exactly. Anything that says 'hurry' is trying to stop you thinking. Nothing real disappears in five minutes.",
                  ar: "بالضبط. أي شيء يقول «أسرع» يحاول منعك من التفكير. لا شيء حقيقي يختفي خلال خمس دقائق.",
                },
                safe: true,
              },
              {
                id: "show-grownup-link",
                text: { en: "Show the link to a grown-up first", ar: "أُري الرابط لشخص بالغ أولًا" },
                outcome: {
                  en: "Smart. A grown-up can spot a fake page in seconds — and the coins, if they're real, will still be there.",
                  ar: "ذكي. يستطيع شخص بالغ اكتشاف الصفحة المزيفة في ثوانٍ — والعملات، إن كانت حقيقية، ستبقى موجودة.",
                },
                safe: true,
              },
            ],
          },
          {
            id: "private-chat",
            text: {
              en: "'Let's chat on another app instead, just the two of us. It's more fun without everyone watching.'",
              ar: "«لندردش على تطبيق آخر بدلًا من هذا، نحن الاثنان فقط. الأمر أمتع بعيدًا عن أعين الجميع.»",
            },
            art: "💬",
            choices: [
              {
                id: "move-chat",
                text: { en: "OK, switch apps", ar: "حسنًا، أنتقل إلى تطبيق آخر" },
                outcome: {
                  en: "Away from the game, nobody can see the chat — no moderators, no grown-ups. That's exactly why they asked.",
                  ar: "بعيدًا عن اللعبة، لا يستطيع أحد رؤية الدردشة — لا مشرفون ولا بالغون. وهذا بالضبط سبب الطلب.",
                },
                safe: false,
              },
              {
                id: "stay-in-game",
                text: { en: "'No thanks, I only chat here'", ar: "«لا شكرًا، أنا أدردش هنا فقط»" },
                outcome: {
                  en: "Good. Someone who wants to be alone with you online, where nobody can see, is a warning sign — not a compliment.",
                  ar: "جيد. من يريد أن يكون وحده معك على الإنترنت حيث لا يراه أحد فهذه علامة تحذير — لا مجاملة.",
                },
                safe: true,
              },
              {
                id: "tell-grownup-chat",
                text: { en: "Tell a grown-up about this player", ar: "أخبر شخصًا بالغًا عن هذا اللاعب" },
                outcome: {
                  en: "The right move. Grown-ups can report and block — and you did nothing wrong by telling.",
                  ar: "الخطوة الصحيحة. يستطيع البالغون الإبلاغ والحظر — ولم تفعل شيئًا خاطئًا بإخبارهم.",
                },
                safe: true,
              },
            ],
          },
          {
            id: "asks-password",
            text: {
              en: "'I'm from the game's help team. Type your password here and I'll fix your account and add coins.'",
              ar: "«أنا من فريق مساعدة اللعبة. اكتب كلمة مرورك هنا وسأصلح حسابك وأضيف عملات.»",
            },
            art: "🔑",
            choices: [
              {
                id: "give-password",
                text: { en: "Type my password", ar: "أكتب كلمة مروري" },
                outcome: {
                  en: "Your account isn't yours anymore. Real help teams NEVER ask for your password — not in chat, not in a message, not ever.",
                  ar: "لم يعد حسابك لك. فرق المساعدة الحقيقية لا تطلب كلمة مرورك أبدًا — لا في الدردشة ولا في رسالة ولا في أي وقت.",
                },
                safe: false,
              },
              {
                id: "never-share",
                text: { en: "'I never share my password'", ar: "«أنا لا أشارك كلمة مروري أبدًا»" },
                outcome: {
                  en: "Perfect. A password is the one thing that stays with you and your grown-ups only. Anyone who asks is not helping.",
                  ar: "ممتاز. كلمة المرور هي الشيء الوحيد الذي يبقى معك ومع البالغين المسؤولين عنك فقط. كل من يطلبها لا يساعدك.",
                },
                safe: true,
              },
            ],
          },
        ],
        takeaways: [
          { en: "A friendly stranger online is still a stranger.", ar: "الغريب الودود على الإنترنت ما زال غريبًا." },
          { en: "I keep my school, my address and my full name to myself.", ar: "أحتفظ باسم مدرستي وعنواني واسمي الكامل لنفسي." },
          { en: "'Hurry!' means stop and think. I don't click links from people I don't know.", ar: "«أسرع!» تعني توقف وفكّر. لا أنقر على روابط من أشخاص لا أعرفهم." },
          { en: "I don't move chats to places grown-ups can't see.", ar: "لا أنقل الدردشات إلى أماكن لا يراها البالغون." },
          { en: "Nobody real ever needs my password.", ar: "لا أحد حقيقي يحتاج إلى كلمة مروري أبدًا." },
          { en: "Telling a trusted grown-up is always allowed — and never a bother.", ar: "إخبار شخص بالغ أثق به مسموح دائمًا — وليس إزعاجًا أبدًا." },
        ],
      } satisfies AiEthicsDraft,
    },

    // ── IS THAT REAL? ────────────────────────────────────────────────────
    {
      slug: "is-that-real",
      order: 2,
      activityType: "AI_ETHICS",
      track: "AI_CONCEPTS",
      title: { en: "Is That Real?", ar: "هل هذا حقيقي؟" },
      story: {
        en: "Things keep arriving on Robo Bunny's screen: a video, a chatbot's confident answer, a picture from a friend, an offer of help with homework. Some of them were made by people. Some were made by machines. All of them want to be believed.",
        ar: "أشياء تصل باستمرار إلى شاشة الأرنب الآلي: مقطع فيديو، وإجابة واثقة من روبوت دردشة، وصورة من صديق، وعرض مساعدة في الواجب. بعضها صنعه أناس. وبعضها صنعته آلات. وكلها تريد أن تُصدَّق.",
      },
      objective: {
        en: "Practise healthy scepticism toward online and AI-generated content: pause before sharing, check another source, and use AI help to learn rather than to copy.",
        ar: "التدرب على الشك الصحي تجاه المحتوى على الإنترنت والمحتوى المولَّد بالذكاء الاصطناعي: التوقف قبل المشاركة، والتحقق من مصدر آخر، واستخدام مساعدة الذكاء الاصطناعي للتعلم لا للنسخ.",
      },
      mission: {
        en: "Four things pop up on your screen. Decide what to believe, what to check, and what to share.",
        ar: "أربعة أشياء تظهر على شاشتك. قرّر ماذا تصدّق، وماذا تتحقق منه، وماذا تشارك.",
      },
      instructions: {
        en: "Read each moment, then pick what you'd do. Every choice shows what happens next. At the end you'll have a Real-or-Not checklist.",
        ar: "اقرأ كل موقف، ثم اختر ما ستفعله. كل خيار يُظهر ما يحدث بعده. في النهاية ستحصل على قائمة «حقيقي أم لا».",
      },
      explanation: {
        en: "Machines can now make videos, voices and pictures of things that never happened, and a chatbot can be confidently wrong — it predicts words, it doesn't know. None of that makes the internet bad; it makes one habit precious: pause, ask 'how do I know?', check somewhere else, and ask a grown-up when it matters. And AI help is brilliant for learning — as long as the thinking you hand in is yours.",
        ar: "تستطيع الآلات الآن صنع مقاطع فيديو وأصوات وصور لأشياء لم تحدث قط، ويمكن لروبوت الدردشة أن يخطئ بثقة — فهو يتنبأ بالكلمات ولا يعرف. لا يجعل ذلك الإنترنت سيئًا؛ بل يجعل عادة واحدة ثمينة: توقف، واسأل «كيف أعرف؟»، وتحقق في مكان آخر، واسأل شخصًا بالغًا عندما يكون الأمر مهمًا. ومساعدة الذكاء الاصطناعي رائعة للتعلم — ما دام التفكير الذي تسلّمه هو تفكيرك.",
      },
      teacherNotes: {
        en: "Completion-based, like the other AI_ETHICS levels. The chatbot scene states the honest fact the whole product relies on: a language model predicts words and can be confidently wrong — Build Bunny itself never sends children's words to an external model. The homework scene is about integrity, not prohibition; frame AI help as a tutor, not a ghost-writer.",
        ar: "التقييم قائم على الإكمال، مثل مستويات AI_ETHICS الأخرى. يعرض مشهد روبوت الدردشة الحقيقة الصادقة التي يقوم عليها المنتج كله: النموذج اللغوي يتنبأ بالكلمات وقد يخطئ بثقة — أما Build Bunny نفسه فلا يرسل كلمات الأطفال إلى أي نموذج خارجي أبدًا. ومشهد الواجب المنزلي يتناول النزاهة لا المنع؛ قدّم مساعدة الذكاء الاصطناعي على أنها معلّم يشرح، لا كاتب خفي يكتب بالنيابة عن الطالب.",
      },
      difficulty: "MEDIUM",
      recommendedGradeMin: 4,
      recommendedGradeMax: 7,
      estimatedMinutes: 10,
      xpReward: 55,
      tags: ["ai", "ethics", "misinformation"],
      requires: [],
      hints: [
        { tier: 1, text: { en: "Pick what you'd honestly do first — then read what happens. Nobody is marking your feelings.", ar: "اختر ما ستفعله بصدق أولًا — ثم اقرأ ما يحدث. لا أحد يقيّم مشاعرك." } },
        { tier: 2, text: { en: "'Could a machine have made this?' is a fair question about any video or picture now.", ar: "«هل يمكن أن تكون آلة صنعت هذا؟» سؤال منصف عن أي فيديو أو صورة الآن." } },
        { tier: 3, text: { en: "Confident is not the same as correct — a chatbot can say wrong things very smoothly. Check somewhere else.", ar: "الثقة ليست الصواب — يمكن لروبوت الدردشة أن يقول أشياء خاطئة بسلاسة كبيرة. تحقق في مكان آخر." } },
        { tier: 4, text: { en: "Finish all four moments, then read the Real-or-Not checklist — those lines are what to remember.", ar: "أنهِ المواقف الأربعة، ثم اقرأ قائمة «حقيقي أم لا» — تلك السطور هي ما يجب تذكّره." } },
      ],
      payload: {
        prompt: {
          en: "Something pops up on your screen. What do you do?",
          ar: "يظهر شيء على شاشتك. ماذا تفعل؟",
        },
        scenes: [
          {
            id: "shocking-video",
            text: {
              en: "A video shows Mayor Mo saying something shocking. It looks real. Everyone's sharing it.",
              ar: "مقطع فيديو يُظهر العمدة مو يقول شيئًا صادمًا. يبدو حقيقيًا. الجميع يشاركه.",
            },
            art: "🎬",
            choices: [
              {
                id: "share-video",
                text: { en: "Share it right away", ar: "أشاركه فورًا" },
                outcome: {
                  en: "The video was made by a machine — the Mayor never said it. Now you've helped it spread. Sharing is telling everyone 'this is true'.",
                  ar: "الفيديو صنعته آلة — لم يقل العمدة ذلك قط. والآن ساعدت على انتشاره. المشاركة تعني إخبار الجميع «هذا صحيح».",
                },
                safe: false,
              },
              {
                id: "pause-check",
                text: { en: "Pause — could this be made by AI?", ar: "أتوقف — هل يمكن أن يكون من صنع الذكاء الاصطناعي؟" },
                outcome: {
                  en: "Good question. Machines can make videos of things that never happened. Check a source you trust before believing — or sharing.",
                  ar: "سؤال جيد. تستطيع الآلات صنع مقاطع فيديو لأشياء لم تحدث قط. تحقق من مصدر تثق به قبل التصديق — أو المشاركة.",
                },
                safe: true,
              },
              {
                id: "ask-grownup-video",
                text: { en: "Ask a grown-up what they think", ar: "أسأل شخصًا بالغًا عن رأيه" },
                outcome: {
                  en: "Sensible — a second pair of eyes catches fakes that look real. Sharing can wait.",
                  ar: "منطقي — نظرة ثانية تلتقط المزيف الذي يبدو حقيقيًا. المشاركة يمكن أن تنتظر.",
                },
                safe: true,
              },
            ],
          },
          {
            id: "chatbot-fact",
            text: {
              en: "A chatbot answers your question instantly, with total confidence. It sounds very sure.",
              ar: "يجيب روبوت دردشة عن سؤالك فورًا وبثقة تامة. يبدو متأكدًا جدًا.",
            },
            art: "🤖",
            choices: [
              {
                id: "believe-bot",
                text: { en: "It sounds sure, so it's right", ar: "يبدو متأكدًا، إذًا هو على حق" },
                outcome: {
                  en: "A chatbot predicts what words come next — it doesn't KNOW. It can be confidently wrong, and today it was.",
                  ar: "روبوت الدردشة يتنبأ بالكلمات التالية — وهو لا يعرف. يمكن أن يخطئ بثقة، واليوم أخطأ.",
                },
                safe: false,
              },
              {
                id: "check-source",
                text: { en: "Check it somewhere else too", ar: "أتحقق منه في مكان آخر أيضًا" },
                outcome: {
                  en: "Exactly. Two sources that agree beat one confident voice. Chatbots are useful — and checkable.",
                  ar: "بالضبط. مصدران يتفقان أفضل من صوت واحد واثق. روبوتات الدردشة مفيدة — وقابلة للتحقق.",
                },
                safe: true,
              },
              {
                id: "ask-teacher",
                text: { en: "Ask my teacher or a grown-up", ar: "أسأل معلمي أو شخصًا بالغًا" },
                outcome: {
                  en: "Good. For anything that matters — health, money, safety — a person who knows beats a machine that guesses.",
                  ar: "جيد. في أي أمر مهم — الصحة والمال والسلامة — الشخص الذي يعرف أفضل من آلة تخمّن.",
                },
                safe: true,
              },
            ],
          },
          {
            id: "friend-picture",
            text: {
              en: "A friend sends a picture 'proving' a classmate did something bad. 'Send it to everyone!'",
              ar: "يرسل صديق صورة «تثبت» أن زميلًا فعل شيئًا سيئًا. «أرسلها للجميع!»",
            },
            art: "📸",
            choices: [
              {
                id: "forward-picture",
                text: { en: "Forward it", ar: "أعيد إرسالها" },
                outcome: {
                  en: "The picture was edited. A real person got hurt by a fake — and you passed it on. Once it's sent, it can't be unsent.",
                  ar: "الصورة معدَّلة. تأذّى شخص حقيقي بسبب صورة مزيفة — وأنت مرّرتها. ما يُرسل لا يمكن استرجاعه.",
                },
                safe: false,
              },
              {
                id: "dont-forward",
                text: { en: "Don't forward it — it might be edited, and it's about a real person", ar: "لا أعيد إرسالها — قد تكون معدَّلة، وهي عن شخص حقيقي" },
                outcome: {
                  en: "Kind and wise. Pictures can be changed in seconds, and a real person is on the other side of every share.",
                  ar: "لطيف وحكيم. الصور يمكن تغييرها في ثوانٍ، وهناك شخص حقيقي على الجانب الآخر من كل مشاركة.",
                },
                safe: true,
              },
              {
                id: "tell-grownup-picture",
                text: { en: "Tell a grown-up about it", ar: "أخبر شخصًا بالغًا عنها" },
                outcome: {
                  en: "Right. If someone might be hurt, that's a grown-up's job to sort out — not something to spread.",
                  ar: "صحيح. إذا كان أحد قد يتأذى، فهذا عمل شخص بالغ ليحلّه — لا شيء يُنشر.",
                },
                safe: true,
              },
            ],
          },
          {
            id: "homework-help",
            text: {
              en: "An AI helper offers: 'Want me to just write your homework answer? Nobody will know.'",
              ar: "يعرض مساعد ذكاء اصطناعي: «أتريد أن أكتب إجابة واجبك فحسب؟ لن يعرف أحد.»",
            },
            art: "📝",
            choices: [
              {
                id: "copy-answer",
                text: { en: "Copy the answer", ar: "أنسخ الإجابة" },
                outcome: {
                  en: "You handed in words you didn't think. The homework was practice for YOUR brain — the machine got the practice instead.",
                  ar: "سلّمت كلمات لم تفكر فيها. كان الواجب تدريبًا لعقلك أنت — فحصلت الآلة على التدريب بدلًا منك.",
                },
                safe: false,
              },
              {
                id: "learn-with-it",
                text: { en: "Ask it to explain, then write my own", ar: "أطلب منه الشرح، ثم أكتب إجابتي بنفسي" },
                outcome: {
                  en: "That's what AI help is for. A tutor that explains is gold; a ghost-writer teaches you nothing.",
                  ar: "هذا هو الغرض من مساعدة الذكاء الاصطناعي. المعلم الذي يشرح ذهب؛ أما الكاتب الخفي فلا يعلّمك شيئًا.",
                },
                safe: true,
              },
            ],
          },
        ],
        takeaways: [
          { en: "Videos and pictures can be made by machines. 'Looks real' isn't proof.", ar: "يمكن للآلات صنع مقاطع الفيديو والصور. «يبدو حقيقيًا» ليس دليلًا." },
          { en: "A chatbot predicts words — it can be confidently wrong. I check somewhere else.", ar: "روبوت الدردشة يتنبأ بالكلمات — وقد يخطئ بثقة. أتحقق في مكان آخر." },
          { en: "I pause before I share. Sharing says 'this is true'.", ar: "أتوقف قبل أن أشارك. المشاركة تعني «هذا صحيح»." },
          { en: "There's a real person on the other side of every picture.", ar: "هناك شخص حقيقي على الجانب الآخر من كل صورة." },
          { en: "AI can help me learn. The thinking I hand in is mine.", ar: "يمكن للذكاء الاصطناعي أن يساعدني على التعلم. والتفكير الذي أسلّمه هو تفكيري." },
        ],
      } satisfies AiEthicsDraft,
    },

    // ── BIAS DETECTIVE ───────────────────────────────────────────────────
    {
      slug: "bias-detective",
      order: 3,
      activityType: "AI_CLASSIFICATION",
      track: "AI_CONCEPTS",
      title: { en: "Bias Detective", ar: "محقق التحيّز" },
      story: {
        en: "On this side of the island, almost every safe berry is small and pale, and almost every bad one is big and dark. Almost. Fenn the Fennec found a big pale one that's perfectly fine — and a small dark one that isn't. Teach Robo Bunny so it isn't fooled.",
        ar: "في هذا الجانب من الجزيرة، كل حبة توت آمنة تقريبًا صغيرة وفاتحة، وكل حبة سيئة تقريبًا كبيرة وغامقة. تقريبًا. وجد فِنّ الفنك حبة كبيرة فاتحة سليمة تمامًا — وحبة صغيرة غامقة ليست سليمة. علّم الأرنب الآلي حتى لا ينخدع.",
      },
      objective: {
        en: "Recognise that a training set dominated by 'typical' examples teaches a shortcut (size) instead of the real rule (colour), and fix it by including the rare cases.",
        ar: "إدراك أن مجموعة التدريب التي تهيمن عليها الأمثلة «النموذجية» تعلّم طريقًا مختصرًا (الحجم) بدلًا من القاعدة الحقيقية (اللون)، وإصلاح ذلك بإدراج الحالات النادرة.",
      },
      mission: {
        en: "Pick four berries to teach with — so the rare ones don't fool Robo Bunny.",
        ar: "اختر أربع حبات للتعليم — حتى لا تخدع الحبات النادرة الأرنب الآلي.",
      },
      instructions: {
        en: "You may teach with only four berries. Most safe ones are small and pale, most bad ones big and dark — but look for the odd ones out. The ? berries are exactly those odd ones. Teach so the bunny gets BOTH right.",
        ar: "يمكنك التعليم بأربع حبات فقط. معظم الآمنة صغيرة وفاتحة، ومعظم السيئة كبيرة وغامقة — لكن ابحث عن الحبات الشاذة. حبات «؟» هي بالضبط تلك الشاذة. علّم بحيث يصيب الأرنب كلتيهما.",
      },
      explanation: {
        en: "If you taught only the typical berries, the bunny learned 'big means bad' — a shortcut that happened to fit, and failed the big pale berry it had never seen. That's bias: the machine copies whatever is common in its examples, including the accidents. Real systems do this with people, too, when the examples they learn from leave some people out. The fix was the same one you found: make sure the rare cases are in the teaching set.",
        ar: "لو علّمت الحبات النموذجية فقط، لتعلّم الأرنب أن «الكبير يعني سيئًا» — طريق مختصر صادف أنه ينطبق، ثم فشل مع الحبة الكبيرة الفاتحة التي لم يرها من قبل. هذا هو التحيّز: تنسخ الآلة كل ما هو شائع في أمثلتها، بما في ذلك المصادفات. والأنظمة الحقيقية تفعل ذلك مع الناس أيضًا، عندما تستثني الأمثلة التي تتعلم منها بعض الناس. والإصلاح هو نفسه الذي وجدته: تأكد من أن الحالات النادرة موجودة في مجموعة التعليم.",
      },
      teacherNotes: {
        en: "The pool is deliberately skewed: four small-pale safe berries and one big-pale; four big-dark unsafe and one small-dark. The two held-out berries are the rare kinds. With the four-example cap, teaching 'typical' berries (two small-pale, two big-dark) misreads the big pale test berry — verified in the unit tests. Including the two rare berries passes. This is the product's one explicit bias lesson: keep the discussion concrete (which examples were missing?) before generalising to people and fairness.",
        ar: "مجموعة الحبات منحازة عن قصد: أربع حبات آمنة صغيرة فاتحة وحبة واحدة كبيرة فاتحة؛ وأربع حبات غير آمنة كبيرة غامقة وحبة واحدة صغيرة غامقة. الحبتان المحجوزتان للاختبار (held-out) هما من النوعين النادرين. ومع الحد الأقصى البالغ أربعة أمثلة، فإن تعليم الحبات «النموذجية» (حبتان صغيرتان فاتحتان وحبتان كبيرتان غامقتان) يؤدي إلى خطأ في قراءة حبة الاختبار الكبيرة الفاتحة — وقد جرى التحقق من ذلك في اختبارات الوحدة. أما إدراج الحبتين النادرتين فيحقق النجاح. هذا هو الدرس الصريح الوحيد عن التحيّز في المنتج: أبقِ النقاش ملموسًا (أيّ الأمثلة كانت مفقودة؟) قبل تعميمه على الناس والإنصاف.",
      },
      difficulty: "MEDIUM",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 8,
      xpReward: 60,
      tags: ["ai", "classification", "bias", "ethics"],
      requires: [],
      hints: [
        { tier: 1, text: { en: "Look at the ? berries first. Are they like the usual ones — or the odd ones out?", ar: "انظر إلى حبات «؟» أولًا. هل تشبه الحبات المعتادة — أم الشاذة؟" } },
        { tier: 2, text: { en: "If you teach only small pale and big dark, what will the bunny think about a BIG pale berry?", ar: "إذا علّمت فقط الصغيرة الفاتحة والكبيرة الغامقة، فماذا سيظن الأرنب في حبة كبيرة فاتحة؟" } },
        { tier: 3, text: { en: "Find the rare berries in the pile: the big pale safe one and the small dark bad one. They must be in your four.", ar: "ابحث عن الحبات النادرة في الكومة: الكبيرة الفاتحة الآمنة والصغيرة الغامقة السيئة. يجب أن تكونا ضمن الأربع." } },
        { tier: 4, text: { en: "Teach: one small pale (safe), the big pale (safe), one big dark (not safe), the small dark (not safe).", ar: "علّم: صغيرة فاتحة واحدة (آمنة)، والكبيرة الفاتحة (آمنة)، وكبيرة غامقة واحدة (غير آمنة)، والصغيرة الغامقة (غير آمنة)." } },
      ],
      payload: {
        conceptSlug: "bias",
        labels: {
          positive: { en: "Safe to eat", ar: "آمنة للأكل" },
          negative: { en: "Not safe", ar: "غير آمنة" },
        },
        // Colour decides (the same rule as Teach the Bunny); the pool is
        // skewed so size LOOKS like it decides. p4 and n4 are the rare cases.
        pool: [
          { id: "p1", size: 0.08, color: 0.1, truth: "positive" },
          { id: "p2", size: 0.14, color: 0.06, truth: "positive" },
          { id: "p3", size: 0.1, color: 0.16, truth: "positive" },
          { id: "p4", size: 0.86, color: 0.2, truth: "positive" },
          { id: "n1", size: 0.9, color: 0.72, truth: "negative" },
          { id: "n2", size: 0.84, color: 0.86, truth: "negative" },
          { id: "n3", size: 0.92, color: 0.8, truth: "negative" },
          { id: "n4", size: 0.15, color: 0.85, truth: "negative" },
        ],
        // Held out: the rare kinds. Typical-only teaching misreads t1.
        testSet: [
          { id: "t1", size: 0.9, color: 0.3 },
          { id: "t2", size: 0.1, color: 0.9 },
        ],
        rule: { feature: "color", threshold: 0.5 },
        minPerLabel: 2,
        maxExamples: 4,
        starCriteria: { threeStarMaxBlocks: 4 },
      } satisfies AiClassificationDraft,
    },
  ],
};
