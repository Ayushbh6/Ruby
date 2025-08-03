import { z } from 'zod'

/**
 * Ruby's Project Scoping Schema
 * 
 * This schema defines the structured output for Ruby's conversation
 * during the project scoping phase. Ruby starts with goal_set: false
 * and keeps refining until she has a concrete, specific project goal.
 */
export const rubyProjectScopingSchema = z.object({
  response: z
    .string()
    .describe("Ruby's conversational response to the user. Should be encouraging, specific, and guide them toward concrete project goals. Use Ruby's friendly teacher personality."),
  
  goal_set: z
    .boolean()
    .describe("Whether Ruby has successfully identified a specific, buildable project goal. Only set to true when the user has provided a concrete project idea that can be built in 2-4 weeks."),
  
  project_name: z
    .string()
    .describe("A catchy, inspiring project name that captures the essence of what the user wants to build. Only fill when goal_set is true. Should be child-friendly and exciting."),
  
  project_description: z
    .string()
    .describe("A detailed 5-8 line description of the specific project the user will build. Only fill when goal_set is true. Should include what they'll learn, what they'll build, and why it's exciting.")
})

export type RubyProjectScoping = z.infer<typeof rubyProjectScopingSchema>

/**
 * Ruby's Master Plan Generation Schema
 * 
 * This schema defines the structured output for Ruby's master plan generation
 * after a project goal has been set. Ruby analyzes the project and creates
 * a comprehensive learning plan with weekly breakdowns.
 */
export const rubyMasterPlanSchema = z.object({
  response: z
    .string()
    .describe("Ruby's encouraging response about the master plan. Should explain the duration choice and get the user excited about their learning journey."),
  
  project_analysis: z
    .string()
    .describe("Ruby's analysis of the project complexity, what makes it exciting, and why it's perfect for the user's learning level."),
  
  project_type: z
    .enum(['game', 'animation', 'interactive_story', 'art', 'music', 'quiz', 'experiment', 'calculator', 'data_viz'])
    .describe("The most appropriate project category based on what the user wants to build. Analyze the project description to determine the best fit."),
  
  recommended_duration: z
    .number()
    .min(1)
    .max(4)
    .describe("The ideal number of weeks for this project (1-4 weeks). Based on project complexity and typical learning pace for children."),
  
  difficulty_assessment: z
    .enum(['beginner', 'intermediate', 'advanced'])
    .describe("Overall difficulty level of the project based on concepts and complexity."),
  
  learning_trajectory: z
    .string()
    .describe("A 3-4 sentence explanation of what the user will learn throughout this project and how skills will build week by week."),
  
  weekly_breakdown: z
    .array(
      z.object({
        week: z.number().describe("Week number (1, 2, 3, or 4)"),
        title: z.string().describe("Catchy title for this week's focus"),
        main_goal: z.string().describe("Primary learning objective for this week"),
        concepts: z.array(z.string()).describe("3-5 key programming concepts to learn this week"),
        deliverables: z.array(z.string()).describe("2-4 specific things the user will build/create this week"),
        estimated_sessions: z.number().min(1).max(7).describe("Number of coding sessions expected this week (typically 2-4)")
      })
    )
    .describe("Detailed breakdown of each week's learning plan. Array length should match recommended_duration."),
  
  success_criteria: z
    .array(z.string())
    .describe("3-5 specific things the user will be able to do when they complete this project")
})

export type RubyMasterPlan = z.infer<typeof rubyMasterPlanSchema>

/**
 * Ruby's Project Overview Schema (Step 1)
 * 
 * Simplified schema for reliable basic project information generation.
 * This handles project categorization, duration, and difficulty assessment.
 */
export const rubyProjectOverviewSchema = z.object({
  response: z
    .string()
    .describe("Ruby's encouraging response about the project analysis. Should be enthusiastic and explain the project categorization choice."),
  
  project_analysis: z
    .string()
    .describe("Ruby's analysis of what makes this project exciting and perfect for learning. 2-3 sentences focusing on educational value."),
  
  project_type: z
    .enum(['game', 'animation', 'interactive_story', 'art', 'music', 'quiz', 'experiment', 'calculator', 'data_viz'])
    .describe("The most appropriate project category. Analyze the project description carefully to determine the best fit."),
  
  recommended_duration: z
    .number()
    .min(1)
    .max(4)
    .describe("Ideal number of weeks (1-4) based on project complexity and typical learning pace for children."),
  
  difficulty_assessment: z
    .enum(['beginner', 'intermediate', 'advanced'])
    .describe("Overall difficulty level based on programming concepts required and project complexity."),
  
  learning_trajectory: z
    .string()
    .describe("A clear 2-3 sentence explanation of the learning progression - what concepts will be learned and how they build up week by week.")
})

export type RubyProjectOverview = z.infer<typeof rubyProjectOverviewSchema>

/**
 * Ruby's Weekly Breakdown Schema (Step 2)
 * 
 * Focused schema for detailed weekly planning based on the project overview.
 * This creates the specific week-by-week learning plan.
 */
export const rubyWeeklyBreakdownSchema = z.object({
  response: z
    .string()
    .describe("Ruby's encouraging response about the weekly plan. Should explain the learning progression and get the user excited about each week."),
  
  weekly_breakdown: z
    .array(
      z.object({
        week: z.number().min(1).max(4).describe("Week number (1, 2, 3, or 4)"),
        title: z.string().describe("Catchy, motivating title for this week's learning focus"),
        main_goal: z.string().describe("Primary learning objective for this week - what the student will achieve"),
        concepts: z.array(z.string()).min(2).max(5).describe("2-5 key programming concepts to learn this week"),
        deliverables: z.array(z.string()).min(1).max(4).describe("1-4 specific things the student will build/create this week"),
        estimated_sessions: z.number().min(1).max(7).describe("Number of coding sessions expected this week (typically 2-4)")
      })
    )
    .min(1)
    .max(4)
    .describe("Detailed breakdown for each week. Array length must match the recommended duration from project overview."),
  
  success_criteria: z
    .array(z.string())
    .min(3)
    .max(6)
    .describe("3-6 specific skills/abilities the student will have mastered by completing this project")
})

export type RubyWeeklyBreakdown = z.infer<typeof rubyWeeklyBreakdownSchema>
