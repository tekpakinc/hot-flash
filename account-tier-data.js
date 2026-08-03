window.HOTFLASH_ACCOUNT_TIERS={
  free:{
    name:'Hot Flash Free',badge:'FREE',price:'$0',billing:'Free forever',audience:'Everything an enthusiast needs to participate in Hot Flash.',accent:'lime',
    intro:'Create your identity, document every vehicle, take part in the community, and use permanent FlashTags without paying for the core social experience.',
    sections:[
      {title:'Personal profile',items:['Create and customize a personal profile','Avatar, banner, display name, username, bio, and general location','Public profile and garage','Follow members and vehicles','Community notifications','Earn Founder recognition and community badges','Submit in-app feedback and feature requests']},
      {title:'Vehicle garage',items:['Create and manage vehicle profiles','Permanent Hot Flash ID and QR-based FlashTag for every vehicle','Vehicle photos, standard videos, specifications, build story, and build updates','Per-vehicle page theme and featured media','Followers, comments, sharing, and contributor display','Download and print existing FlashTag artwork','Transfer vehicle ownership while preserving its permanent identity and eligible history']},
      {title:'Community and discovery',items:['Browse the community feed, vehicles, shops, events, and Hoon Pad','Follow builds and participate in comments','Browse and RSVP to events','Receive positive event recognition and community badges','Use reporting, blocking, privacy, and safety tools as available']},
      {title:'Standard media access',items:['Upload normal vehicle photos and videos within standard limits','Post legal action clips to Hoon Pad','Link media to vehicles and build history','Share your own content and vehicle pages']},
      {title:'Not included',negative:true,items:['Verified identity badge','Creator, photographer, media, reviewer, or contributor capability tools','Featured-content eligibility reserved for Verified members','Premium media limits and advanced portfolio tools','Platform sales, e-tuning, paid business marketing, or shop analytics']}
    ]
  },
  verified:{
    name:'Hot Flash Verified',badge:'VERIFIED',price:'$1.99',billing:'Per month',audience:'Trusted members who create, document, teach, review, organize, or represent the automotive community.',accent:'purple',
    intro:'Verified confirms the member is accountable and in good standing. It also unlocks the creator, photographer, media, reviewer, organizer, and contributor tools that are not available to a standard Free member.',
    requirements:['Identity or account verification completed through an approved Hot Flash process.','Account must remain in good community standing.','Verification is not a promise of professional skill, safety, endorsement, or fame.'],
    sections:[
      {title:'Everything in Hot Flash Free',items:['Personal profile, vehicles, permanent FlashTags, community participation, events, shops, and Hoon Pad access']},
      {title:'Verified identity',items:['Verified member badge','Eligibility to link a Community Shop through the personal-profile verification path','Priority trust and accountability indicators where appropriate','Access may be reviewed or removed if account standing changes']},
      {title:'Creator and media capabilities',items:['Creator tools and creator contribution tag','Photographer and videographer portfolio tools','Media-contributor and event-coverage tools','Vehicle and event media attribution','Expanded upload and media-management limits as released','Eligible featured-content submission and discovery placement','Advanced profile presentation for original work']},
      {title:'Specialized contribution capabilities',items:['Optional Photographer, Videographer, Creator, Media, Reviewer, Journalist, Builder, Organizer, Mentor, or Ambassador tags','Capabilities may be granted individually based on the member’s work, role, or contribution','A member may hold multiple contribution tags without changing account type','Tags describe contribution; the Verified badge confirms identity and accountability']},
      {title:'Premium member tools',items:['Premium profile and vehicle presentation options','Advanced garage and audience analytics as released','Early access to selected beta tools','Priority support and community opportunities','Exclusive challenges, recognition opportunities, and FlashTag discounts as offered']},
      {title:'Not included',negative:true,items:['A public shop page unless a separate Community Shop is created','Selling products or accepting platform payments','Shop Pro marketing, e-tuning, referral wallet, or business analytics']}
    ]
  },
  community_shop:{
    name:'Community Shop',badge:'FREE SHOP',price:'$0',billing:'Free community tier',audience:'Builders, home garages, local shops, organizers, and clubs that need accountable community tools.',accent:'blue',
    intro:'A public shop presence and scoped Community Steward tools without requiring a paid subscription or enabling platform monetization.',
    requirements:['The shop must be linked to a Verified personal profile, or verified through an accepted business identifier such as an EIN or equivalent registration number.','Every shop has an accountable owner. Managers and event staff may be invited separately.'],
    sections:[
      {title:'Linked member access',items:['The shop exists separately from its owner’s personal account','A linked Verified member keeps all Verified creator/media capabilities','Business-identifier verification may create a shop without changing the owner’s personal member tier']},
      {title:'Public shop page',items:['Shop name, custom address, description, logo, and banner','Location, website, email, phone, and business hours','Services and specialties','Verification status and Community Steward badge','Free-versus-Pro capability display']},
      {title:'Staff and ownership',items:['Protected shop owner role','Invite and remove managers','Invite and remove event staff','Managers may maintain the public shop page','Event staff receive only scoped Steward tools']},
      {title:'Community Steward tools',items:['Host eligible events','Moderate the shop’s own pages and hosted events','Award approved positive community recognition','Submit private incident reports for review','Verify professional work performed on a vehicle']},
      {title:'Not included',negative:true,items:['Selling products or services through Hot Flash','Accepting platform payments','E-tuning workflow','Paid promotions or featured placement','Advanced business analytics','Referral-credit wallet and marketing perks']}
    ]
  },
  shop_pro:{
    name:'Shop Pro',badge:'SHOP PRO',price:'$59.99',billing:'Every 6 months',audience:'Automotive businesses ready to monetize, market, and grow through Hot Flash.',accent:'orange',
    intro:'Everything in Community Shop plus paid business tools designed to create measurable value for professional automotive businesses.',
    requirements:['A verified Community Shop in good standing.','Current Shop Pro subscription and compliance with Hot Flash business, payment, and community rules.'],
    sections:[
      {title:'Everything in Community Shop',items:['Public shop page, staff roles, verification, events, recognition, incident reporting, and professional-work verification']},
      {title:'Commerce and customer tools',items:['Sell eligible products and services through Hot Flash','Accept supported platform payments','Quote, scheduling, and customer-management tools as released','Expanded marketplace and service listings']},
      {title:'E-tuning',items:['Offer remote tuning services','Customer intake and vehicle information workflow','File delivery, revision tracking, and communication tools as released']},
      {title:'Marketing and growth',items:['Eligible featured placement and promotional tools','Business analytics and shop insights','Marketing perks and promotional campaigns','Expanded staff and business-management tools']},
      {title:'Referral program',items:['Earn $1 in account credit when an eligible referred member signs up and adds their first qualifying vehicle','Credits apply toward the $59.99 semiannual renewal','Credits may roll into a positive balance for future renewals','Credits have no cash value and remain subject to anti-abuse and qualification rules']}
    ]
  }
};