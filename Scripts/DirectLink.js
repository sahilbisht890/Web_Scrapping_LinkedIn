import puppeteer from 'puppeteer';
import XLSX from "xlsx";
import dotenv from 'dotenv';
dotenv.config({ path: '../loginDetails.env' });

let count = 0;
let objData = [];
let maxData = 400;
const fileName='LogisticsData';       //enter the fileN name

(async () => {


  const link ='https://www.linkedin.com/search/results/companies/?companyHqGeo=%5B%2290010392%22%2C%22109019211%22%2C%22102650197%22%5D&keywords=logistics&origin=FACETED_SEARCH&searchId=bf7e4751-465b-42c4-803a-cb13a7a9831c&sid=hIK';
  const email = process.env.USER6;  
  const password = process.env.PASSWORD6;

  /*
      FOR THE COMAPNY SIZE USING ID : 

      ID >> companySize-B :  1-10 employees 
      ID >> companySize-C :  11-50 employees 
      ID >> companySize-D :  51-200 employees 
      ID >> companySize-E :  201-500 employees 
      ID >> companySize-F :  501-1000 employees 
      ID >> companySize-G :  1001-5000 employees 
      ID >> companySize-H :  5001-10,000 employees 
  */



  const browser = await puppeteer.launch({ headless: false, slowMo: 20 });

  //const context = await browser.createBrowserContext(); 

  const page = await browser.newPage();

  await page.goto(link, {
    args: [
      '--incognito'
    ],
    timeout: 200000
  });

  await page.setViewport({ width: 1280, height: 1024 });

  //logging into  the linkedin account 

  await page.waitForSelector('#username');

  //await page.locator('button').wait() alternate for waitForSelector

  await page.type('#username', email);
  await page.waitForSelector('#password');
  await page.type('#password', password);
  await page.keyboard.press('Enter');

  await page.waitForNavigation();

  //for navigate to the next page and fetching the data from the each page
  while (true) {
    try {
   
      if (maxData == 0) break;      //breaking the loop when maxData is zero 

      //fetching the data 
      await dataFetch(page, browser);

      //checking if the next button is clickable or not 

      const nextBtn = await page.waitForSelector('button[aria-label="Next"]',{timeout:60000});
      let continueOrNot = await page.evaluate(element => element.disabled, nextBtn);

      console.log(continueOrNot);
      if (continueOrNot) break;   //if there is no next page exit the loop

      await nextBtn.click();
      await page.waitForNavigation();
    }
    catch (error) {
      console.log('no next button');
      break;
    }
  }

  console.log(objData);
  toExcel(objData, fileName);
  await browser.close();    //closing the browser

})();



//function to fetch the data from the page
async function dataFetch(page, browser) {
  let links = [];
  const dataContainer = await page.waitForSelector('.search-results-container');
  let listCard = await dataContainer.$$('.reusable-search__result-container');

  //fetching the link from the data and adding about/ to it so can directly navigate there 
  for (let i in listCard) {
    let val = listCard[i];
    let sizeOfData = await val.$$('div');
    if (sizeOfData.length > 1) {
      let anchor = await val.$('a');
      //storing the link in array

      const linkaddress = await page.evaluate(element => element.getAttribute('href'), anchor);

      links.push(linkaddress + 'about/');
    }
  };


  //fetching the data from each links 
  for (let i in links) {
    if (maxData == 0) break;



    let val = await fetchDataValue(links[i], browser);
    ++count;
    console.log("Total Iteration : ", count);
    if (Object.keys(val).length != 0) {
      objData.push(val);
      --maxData;
    }

  }
}

//function to fetch the value from the each link 

async function fetchDataValue(link, browser) {

  //opening the link into the new tab
  const page = await browser.newPage();

  await page.goto(link, {
    args: [
      '--incognito'
    ],
    timeout: 200000,
  });
  await page.setViewport({ width: 1280, height: 1024 });


  //Delay for around 2 seconds
  await delay(4000);

  const fetchingValues = await page.evaluate(() => {
    let tempData = {};
    try {
      console.log('fetchingValue');
      const datalist = document.querySelector('dl');
      if (datalist == null) return {};

      const companyname = document.querySelector('h1').innerText.trim();
      tempData['Company Name'] = companyname;

      const dt = Array.from(datalist.querySelectorAll('dt'));
      const dd = Array.from(datalist.querySelectorAll('dd'));

      //these fields value data we are fetching 
      const neededFields = ['Website', 'Industry', 'Company size', 'Headquarters', 'Phone', 'Founded'];
      let index = 0;

      dt.forEach((val) => {
        let dataFieldValue = val.innerText.trim();

        if (neededFields.includes(dataFieldValue)) {

          let dataValue = dd[index].innerText.trim();
          if (dataFieldValue == 'Phone')
            dataValue = dataValue.slice(0, dataValue.indexOf('P') - 1);

          tempData[dataFieldValue] = dataValue;

          if (dataFieldValue == 'Company size' && dt.length < dd.length)
            ++index;
        }
        ++index;

      });

    }
    catch (err) {
      return {};
    }

    console.log(tempData);
    return tempData;
  });

  await page.close();

  return fetchingValues;
}

//converting the data into the excel file 
function toExcel(data, FileName) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const filePath = `../ExcelData/${FileName}data.xlsx`
  XLSX.writeFile(wb, filePath);
}


//function for delay 
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}








