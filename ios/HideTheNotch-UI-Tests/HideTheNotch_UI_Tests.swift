//
//  HideTheNotch_UI_Tests.swift
//  HideTheNotch-UI-Tests
//
//  Created by Maxime Thirouin on 13/11/2017.
//  Copyright © 2017 Facebook. All rights reserved.
//

import XCTest

class HideTheNotch_UI_Tests: XCTestCase {

    override func setUp() {
        super.setUp()

        // Put setup code here. This method is called before the invocation of each test method in the class.

        // In UI tests it is usually best to stop immediately when a failure occurs.
        continueAfterFailure = false
        // UI tests must launch the application that they test. Doing this in setup will make sure it happens for each test method.
        XCUIApplication().launch()

        // In UI tests it’s important to set the initial state - such as interface orientation - required for your tests before they run. The setUp method is a good place to do this.
    }

    override func tearDown() {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
        super.tearDown()
    }

    func testExample() {
      let app = XCUIApplication()
      setupSnapshot(app)
      snapshot("01HomeScreen")

      app/*@START_MENU_TOKEN@*/.otherElements[""]/*[[".otherElements.matching(identifier: \"In progress     \")",".otherElements.matching(identifier: \"    \").otherElements[\"\"]",".otherElements[\"\"]"],[[[-1,2],[-1,1],[-1,0,1]],[[-1,2],[-1,1]]],[0]]@END_MENU_TOKEN@*/.tap()
      snapshot("02Effect")

      // default
      //app/*@START_MENU_TOKEN@*/.otherElements["Rounded Notch"]/*[[".otherElements.matching(identifier: \"In progress Rounded Notch Rounded Slim Notch Hard Notch Hard Slim Notch     \")",".otherElements[\"Rounded Notch Rounded Slim Notch Hard Notch Hard Slim Notch     \"]",".otherElements[\"Rounded Notch Rounded Slim Notch Hard Notch Hard Slim Notch\"].otherElements[\"Rounded Notch\"]",".otherElements[\"Rounded Notch\"]"],[[[-1,3],[-1,2],[-1,1,2],[-1,0,1]],[[-1,3],[-1,2],[-1,1,2]],[[-1,3],[-1,2]]],[0]]@END_MENU_TOKEN@*/.tap()

      app/*@START_MENU_TOKEN@*/.otherElements["Rounded Slim Notch"]/*[[".otherElements.matching(identifier: \"In progress Rounded Notch Rounded Slim Notch Hard Notch Hard Slim Notch     \")",".otherElements[\"Rounded Notch Rounded Slim Notch Hard Notch Hard Slim Notch     \"]",".otherElements[\"Rounded Notch Rounded Slim Notch Hard Notch Hard Slim Notch\"].otherElements[\"Rounded Slim Notch\"]",".otherElements[\"Rounded Slim Notch\"]"],[[[-1,3],[-1,2],[-1,1,2],[-1,0,1]],[[-1,3],[-1,2],[-1,1,2]],[[-1,3],[-1,2]]],[0]]@END_MENU_TOKEN@*/.tap()
      snapshot("03Effect")

      app/*@START_MENU_TOKEN@*/.otherElements["Hard Notch"]/*[[".otherElements.matching(identifier: \"In progress Rounded Notch Rounded Slim Notch Hard Notch Hard Slim Notch     \")",".otherElements[\"Rounded Notch Rounded Slim Notch Hard Notch Hard Slim Notch     \"]",".otherElements[\"Rounded Notch Rounded Slim Notch Hard Notch Hard Slim Notch\"].otherElements[\"Hard Notch\"]",".otherElements[\"Hard Notch\"]"],[[[-1,3],[-1,2],[-1,1,2],[-1,0,1]],[[-1,3],[-1,2],[-1,1,2]],[[-1,3],[-1,2]]],[0]]@END_MENU_TOKEN@*/.tap()
      snapshot("04Effect")

      app/*@START_MENU_TOKEN@*/.otherElements["Hard Slim Notch"]/*[[".otherElements.matching(identifier: \"In progress Rounded Notch Rounded Slim Notch Hard Notch Hard Slim Notch     \")",".otherElements[\"Rounded Notch Rounded Slim Notch Hard Notch Hard Slim Notch     \"]",".otherElements[\"Rounded Notch Rounded Slim Notch Hard Notch Hard Slim Notch\"].otherElements[\"Hard Slim Notch\"]",".otherElements[\"Hard Slim Notch\"]"],[[[-1,3],[-1,2],[-1,1,2],[-1,0,1]],[[-1,3],[-1,2],[-1,1,2]],[[-1,3],[-1,2]]],[0]]@END_MENU_TOKEN@*/.tap()
      snapshot("05Effect")
    }

}
