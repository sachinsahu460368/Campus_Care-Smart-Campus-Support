const ago = hours => Date.now() - hours * 3600000;
export const initialComplaints = [
  { id:'C001', category:'Wi-Fi', problemType:'Slow internet', description:'Wi-Fi is slow in the library study area.', location:'Library', submittedAt:ago(48), status:'Raised', severity:'High', demo:true },
  { id:'C002', category:'Hostel', problemType:'Water supply', description:'Hot water supply is unavailable on the second floor.', location:'North Hostel · Floor 2', submittedAt:ago(8), status:'In Progress', severity:'Medium', demo:true },
  { id:'C003', category:'Classroom', problemType:'Projector not working', description:'Projector in Room 204 will not display lecture slides.', location:'Academic Block · Room 204', submittedAt:ago(72), status:'Raised', severity:'Critical', demo:true },
  { id:'C004', category:'Laboratory', problemType:'Equipment failure', description:'Bench power outlet is faulty in the electronics lab.', location:'Electronics Lab', submittedAt:ago(24), status:'Resolved', severity:'High', demo:true }
];
export const problemTypes = {
  'Wi-Fi':['Internet not working','Slow internet','Weak Wi-Fi signal','Frequent disconnection'],
  Hostel:['Water supply','Electricity','Cleanliness','Maintenance'],
  Classroom:['Projector not working','Fan issues','Lighting problems','Furniture damage'],
  Laboratory:['Computer malfunction','Equipment failure','Software installation issues','Network problems']
};
