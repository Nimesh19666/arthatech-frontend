// The standard departments printed on the docket's "Crew Count Summary" (page 5).
// page = the docket page where that department's attendance sheet is.
export const DEFAULT_TEAMS = [
  ["Artist and Character Artist", 6], ["Artist Staff", 7], ["Junior Artist / Crowd / Model", 8],
  ["Director & Direction Team", 9], ["DOP, Camera Attn. & Focus Pullers", 9],
  ["Production Staff / Office Staff / Auditors", 10], ["ART Department", 10], ["ART - Setting Workers", 11],
  ["Costume Stylist & Asst.", 12], ["Costume Dressman / Tailors / Asst.", 12], ["Make-up & Hair", 12],
  ["DIT", 13], ["Co. Electrician", 13], ["Dolly Panther", 13], ["Drone", 13], ["Still & Making", 13],
  ["Light Department", 14], ["Jimmy Jib", 15], ["Rostum", 15], ["Stunt / Action Team", 15],
  ["SFX", 16], ["Steadicam Editor", 16], ["Spot / Production Boys", 16],
  ["Editor", 17], ["Sound", 17], ["Security", 17], ["Ambulance / Doctor / Firemen", 17],
  ["PA/AC/Walkie/Tent", 18], ["Location Manager / Location Staff / Local LP Team", 19],
  ["Catering Staff", 21], ["Additional Crew", 22],
].map(([name, page]) => ({ name, kind: "crew", page })).concat(
  [["Picture Vehicle", 18], ["Vanity Van", 19], ["Generator", 20], ["Production Vehicles", 20], ["Production Truck / Tempo / Pickup", 21]].map(
    ([name, page]) => ({ name, kind: "vehicle", page })
  )
);
