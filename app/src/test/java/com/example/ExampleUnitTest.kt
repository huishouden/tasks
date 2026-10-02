package com.example

import org.junit.Assert.*
import org.junit.Test

/**
 * Example local unit test, which will execute on the development machine (host).
 *
 * See [testing documentation](http://d.android.com/tools/testing).
 */
class ExampleUnitTest {
  @Test
  fun addition_isCorrect() {
    assertEquals(4, 2 + 2)
  }

  @Test
  fun testCategoryGuessing() {
    assertEquals(com.example.data.model.CategoryConstants.DAIRY_EGGS, com.example.data.repository.HearthRepository.guessCategory("Whole Milk 2%"))
    assertEquals(com.example.data.model.CategoryConstants.PRODUCE, com.example.data.repository.HearthRepository.guessCategory("Organic Bananas"))
    assertEquals(com.example.data.model.CategoryConstants.BAKERY, com.example.data.repository.HearthRepository.guessCategory("Sourdough Bread"))
    assertEquals(com.example.data.model.CategoryConstants.HOUSEHOLD, com.example.data.repository.HearthRepository.guessCategory("Bounty Paper Towels"))
    assertEquals(com.example.data.model.CategoryConstants.BEVERAGES, com.example.data.repository.HearthRepository.guessCategory("Cold Brew Coffee"))
  }
}
