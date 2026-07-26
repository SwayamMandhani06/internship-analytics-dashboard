const http = require('http');

http.get('http://localhost:3001/api/students?batch=2023-2027', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const j = JSON.parse(data);

    // Find Piyush
    const piyush = j.data.find(s => s.name.includes('Piyush') && s.name.includes('Patil'));
    console.log('=== PIYUSH RAJKUMAR PATIL ===');
    if (piyush) {
      console.log('PRN:', piyush.prn, '| Div:', piyush.division);
      console.log('Total calculated credits:', piyush.totalCreditsCalculated);
      console.log('Sheet reported total:', piyush.sheetReportedTotalCredits);
      console.log('Sheet reported remaining:', piyush.sheetReportedRemainingCredits);
      console.log('Internships:', piyush.internships.length);
      for (const i of piyush.internships) {
        console.log('  [' + i.semesterLabel + '] ' + i.company);
        console.log('    Duration: "' + i.durationRaw + '" => ' + i.durationMonths + ' mo (cert=' + i.isCertificationStyle + ')');
        console.log('    Dates: "' + i.startDateRaw + '" => ' + i.startDate + ' | "' + i.endDateRaw + '" => ' + i.endDate);
        console.log('    Status:', i.status, '| Credits:', i.creditsCalculated, '| Review:', i.needsReview, i.needsReview ? '[' + i.reviewReasons.join(',') + ']' : '');
      }
    } else {
      console.log('NOT FOUND');
    }

    console.log();

    // Find Shweta
    const shweta = j.data.find(s => s.name.includes('Shweta') && s.name.includes('Jadhav'));
    console.log('=== SHWETA POPATRAO JADHAV ===');
    if (shweta) {
      console.log('PRN:', shweta.prn, '| Div:', shweta.division);
      console.log('Total calculated credits:', shweta.totalCreditsCalculated);
      console.log('Sheet reported total:', shweta.sheetReportedTotalCredits);
      console.log('Sheet reported remaining:', shweta.sheetReportedRemainingCredits);
      console.log('Internships:', shweta.internships.length);
      for (const i of shweta.internships) {
        console.log('  [' + i.semesterLabel + '] ' + i.company);
        console.log('    Duration: "' + i.durationRaw + '" => ' + i.durationMonths + ' mo (cert=' + i.isCertificationStyle + ')');
        console.log('    Dates: "' + i.startDateRaw + '" => ' + i.startDate + ' | "' + i.endDateRaw + '" => ' + i.endDate);
        console.log('    Status:', i.status, '| Credits:', i.creditsCalculated, '| Review:', i.needsReview, i.needsReview ? '[' + i.reviewReasons.join(',') + ']' : '');
      }
    } else {
      console.log('NOT FOUND');
    }
  });
});
