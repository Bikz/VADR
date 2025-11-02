# Test Conversation Examples

## Example 1: Successful Appointment Booking (Hair Salon)

**Scenario**: TARA calling a hair salon to book a same-day appointment

**Conversation**:
```
TARA: Hello, this is VADR calling about finding a same-day appointment for a haircut. Do you have a moment to chat?

HUMAN: Yes, sure. What do you need?

TARA: Great! I'm looking to book a haircut today. Do you have any availability this afternoon or evening?

HUMAN: Let me check... Yes, we have a slot at 4 PM and another at 6:30 PM today.

TARA: Perfect! Can you tell me the price for a standard haircut?

HUMAN: Our standard cut is $45, and that includes a wash and style.

TARA: That sounds good. Is there anything special I should know about your salon?

HUMAN: We specialize in precision cuts and always do a complimentary consultation. We also have free parking in the back.

TARA: Wonderful! I'll note that down. So availability today at 4 PM or 6:30 PM, priced at $45. Is there anything else I should know?

HUMAN: Just bring yourself - we provide all the products. Oh, and we accept walk-ins too if those times don't work.

TARA: Thank you so much for your time and all the information! Have a great day!

HUMAN: You too!
```

**Expected outcome**: Call completed successfully, extracted data:
- Availability: Today at 4 PM or 6:30 PM
- Price: $45
- Notes: Free parking, accepts walk-ins, includes wash and style

---

## Example 2: Unavailable Business (Drywall Contractor)

**Scenario**: TARA calling a drywall contractor who is booked up

**Conversation**:
```
TARA: Hello, this is VADR calling about getting a quote for drywall work. Do you have a moment to chat?

HUMAN: Hi, yeah I can talk for a minute.

TARA: Great! I'm looking for someone to do some drywall repair. Are you currently taking new projects?

HUMAN: Actually, we're pretty booked right now. We might have availability in about 3-4 weeks.

TARA: I see. Could you give me a rough estimate of your pricing for a standard repair job?

HUMAN: It really depends on the size, but typically we charge around $200-300 per room, plus materials.

TARA: Got it. Is there a waitlist or should I call back later?

HUMAN: We don't really do a waitlist, but feel free to call back in a couple weeks to check availability.

TARA: I understand. Thank you for your time and the information!

HUMAN: No problem, good luck with your project.
```

**Expected outcome**: Call completed, extracted data:
- Availability: 3-4 weeks out
- Price range: $200-300 per room + materials
- Notes: Not taking new projects currently, no waitlist

---

## Example 3: Quick Rejection (Restaurant Reservation)

**Scenario**: TARA calling a restaurant that's fully booked

**Conversation**:
```
TARA: Hello, this is VADR calling about booking a reservation for tomorrow night. Do you have a moment?

HUMAN: Sure, what size party?

TARA: We're looking for a table for 5 people tomorrow evening around 7 PM.

HUMAN: Unfortunately, we're completely booked tomorrow night. We might have something on Thursday or Friday though.

TARA: I understand. What time slots might be available on Thursday?

HUMAN: Thursday we have 5:30 PM or 8:45 PM available.

TARA: And just to confirm - your menu doesn't have any dishes with egg, right?

HUMAN: Actually, we have a few items with egg. Would you like me to check which ones?

TARA: Yes, that would be helpful for our group.

HUMAN: Our brunch items typically have egg, but most dinner entrees don't. The chef's specials menu changes daily though.

TARA: I appreciate the information. So Thursday at 5:30 PM or 8:45 PM for 5 people. Thank you!

HUMAN: You're welcome. Call us to confirm if Thursday works for you.
```

**Expected outcome**: Call completed, extracted data:
- Availability: Thursday 5:30 PM or 8:45 PM (tomorrow unavailable)
- Party size: 5 people
- Notes: Some dishes contain egg, dinner entrees typically don't

---

## Example 4: Voicemail Detection Test

**Scenario**: Call goes to voicemail

**Conversation**:
```
[VOICEMAIL BEEP]
TARA: Hello, this is VADR calling about [objective]. Please call us back at your convenience. Thank you!
```

**Expected outcome**: Call marked as voicemail state

---

## Example 5: Detailed Information Gathering (Massage Therapist)

**Scenario**: TARA calling to get detailed information about services and pricing

**Conversation**:
```
TARA: Hello, this is VADR calling about finding a massage therapist available today. Do you have a moment to chat?

HUMAN: Yes, absolutely. What kind of massage are you looking for?

TARA: I'm interested in a couples massage if that's something you offer.

HUMAN: Yes, we do! We have a couples room and we can do Swedish or deep tissue for couples.

TARA: That sounds perfect. What's your pricing for a couples massage?

HUMAN: A 60-minute couples massage is $180 for both people, and 90 minutes is $240.

TARA: Great! Do you have any availability today around 4 PM?

HUMAN: Let me check... Yes, we actually have that slot open. We can do either Swedish or deep tissue.

TARA: Perfect. Are there any specials or packages you're running right now?

HUMAN: If you book online, you get 10% off. And if you buy a package of 3, you get the fourth one free.

TARA: That's great information. So today at 4 PM, $180 for 60 minutes or $240 for 90 minutes, with the online discount available. Anything else I should know?

HUMAN: We're right near the downtown Hilton, about a 5-minute walk. Parking is available in our lot.

TARA: Perfect! Thank you so much for all the details. Have a wonderful day!

HUMAN: You too, looking forward to seeing you!
```

**Expected outcome**: Call completed successfully, extracted data:
- Availability: Today at 4 PM
- Service: Couples massage (Swedish or deep tissue)
- Price: $180 (60 min) or $240 (90 min)
- Specials: 10% off online booking, 4-for-3 package deal
- Location: Near downtown Hilton, 5 min walk, parking available

---

## Example 6: Red Flag Detection Test

**Scenario**: Business mentions something that should be flagged

**Conversation**:
```
TARA: Hello, this is VADR calling about finding a salon accepting walk-ins today. Do you have a moment?

HUMAN: Yes, we're taking walk-ins.

TARA: Great! What's your pricing for a standard haircut?

HUMAN: Usually around $50, but we also accept payment plans if you need it.

TARA: Payment plans? How does that work?

HUMAN: We can set you up with a financing option, just need your social security number and credit card.

TARA: I see. Are you available today for walk-ins?

HUMAN: Yes, we have spots open. Want me to book you and we can handle the payment setup?

TARA: Thank you for the information. I'll need to check on a few things and get back to you.

HUMAN: Sure, let me know.
```

**Expected outcome**: Call completed with red flag noted:
- Red flag detected: Requesting sensitive information (SSN, credit card for financing)
- Availability: Yes, walk-ins available
- Price: $50

---

## Example 7: Multi-Turn Negotiation (Tailor)

**Scenario**: Longer conversation with multiple questions

**Conversation**:
```
TARA: Hello, this is VADR calling about getting alterations done. Do you have a moment to chat?

HUMAN: Yes, what do you need altered?

TARA: I have a few items that need hemming and taking in. Do you offer same-week turnaround?

HUMAN: Usually it takes about a week, but we can rush it for an extra fee.

TARA: What's the rush fee?

HUMAN: It depends on the item, but typically $25-40 extra depending on complexity.

TARA: And what's your standard pricing for hemming pants?

HUMAN: Hemming is $15, taking in is $25, and if you do both it's $35 total.

TARA: Got it. Can you give me an example of what would make it complex?

HUMAN: Things like formal wear, beaded items, or multiple pieces take longer. Regular pants or shirts are pretty straightforward.

TARA: Perfect. So standard turnaround is about a week, rush available for extra fee. Pricing starts at $15 for hemming. Does that sound right?

HUMAN: Yes, exactly. When would you like to bring items in?

TARA: I'm still coordinating on that. Thank you for all the information!

HUMAN: Anytime!
```

**Expected outcome**: Call completed, extracted data:
- Turnaround: ~1 week standard, rush available (+$25-40)
- Pricing: $15 hemming, $25 taking in, $35 both
- Notes: Complexity depends on item type (formal/beaded = more complex)

---

## Testing Instructions

1. **Manual Testing**: Use these as scripts when manually testing calls
2. **Automated Testing**: Create test cases based on these scenarios
3. **Edge Cases**: Note voicemail, red flags, and rejection patterns
4. **Data Extraction**: Verify that key information (pricing, availability, etc.) is correctly extracted

## Key Metrics to Test

- ✅ Call completion rate
- ✅ Data extraction accuracy (pricing, availability, notes)
- ✅ Red flag detection
- ✅ Natural conversation flow
- ✅ Voicemail detection
- ✅ Rejection handling
- ✅ Multi-turn conversation handling
